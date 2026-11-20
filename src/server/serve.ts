import { env } from "cloudflare:workers";
import { getEveryAppUser } from "@every-app/sdk/server";
import { rememberUser, type ItemRow } from "./access";
import { NotFound, Refused } from "./items";
import { inlineType } from "./roles";

const notFound = () => new Response("Not found", { status: 404 });

/** The file's bytes; inline only for types that can't run script. */
export async function serveFile(
  request: Request,
  item: Pick<ItemRow, "kind" | "name" | "mimeType" | "objectKey">,
  download: boolean,
): Promise<Response> {
  if (item.kind !== "file" || !item.objectKey) return notFound();
  const range = request.headers.get("range");
  const object = await env.files.get(
    item.objectKey,
    range ? { range: request.headers } : {},
  );
  if (!object || !("body" in object)) return notFound();
  const inline = download ? null : inlineType(item.mimeType, item.name);
  const headers = new Headers({
    "content-type": inline ?? "application/octet-stream",
    "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(item.name)}`,
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
  });
  if (!inline || !inline.startsWith("application/pdf"))
    headers.set(
      "content-security-policy",
      "sandbox; default-src 'none'; media-src 'self'; img-src 'self'",
    );
  const r = object.range as { offset?: number; length?: number } | undefined;
  if (range && r && r.offset !== undefined) {
    const length = r.length ?? object.size - r.offset;
    headers.set(
      "content-range",
      `bytes ${r.offset}-${r.offset + length - 1}/${object.size}`,
    );
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

/** A member's request to a private endpoint; refuses cross-site posts. */
export async function memberOf(request: Request) {
  const user = await getEveryAppUser(request, env);
  if (!user) return null;
  await rememberUser(user);
  return user;
}

export function crossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return !!site && site !== "same-origin" && site !== "none";
}

export function failure(error: unknown): Response {
  if (error instanceof NotFound) return notFound();
  if (error instanceof Refused)
    return Response.json({ error: error.message }, { status: 403 });
  if (error && typeof error === "object" && "issues" in error)
    return Response.json({ error: "Invalid input" }, { status: 400 });
  throw error;
}
