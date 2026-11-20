import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  chainOf,
  getAccess,
  ITEM_COLUMNS,
  type Actor,
  type ItemRow,
} from "./access";
import { NotFound, Refused, readText } from "./items";
import { canEdit, endOfDay, isLive, previewKind } from "./roles";

export const linkInput = z
  .object({
    itemId: z.string().min(1),
    allowDownload: z.boolean(),
    expires: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .strict();

interface LinkRow {
  token: string;
  itemId: string;
  allowDownload: number;
  expiresAt: string | null;
}
const LINK_COLUMNS =
  "token, item_id AS itemId, allow_download AS allowDownload, expires_at AS expiresAt";

async function editableItem(user: Actor, itemId: string) {
  const access = await getAccess(user, itemId);
  if (!access) throw new NotFound();
  if (!canEdit(access.role)) throw new Refused("You can't share this item.");
}

export async function getLink(user: Actor, itemId: string) {
  await editableItem(user, itemId);
  const row = await env.DB.prepare(
    `SELECT ${LINK_COLUMNS} FROM links WHERE item_id = ?1`,
  )
    .bind(itemId)
    .first<LinkRow>();
  if (!row) return null;
  return {
    token: row.token,
    allowDownload: !!row.allowDownload,
    expires: row.expiresAt?.slice(0, 10) ?? null,
    expired: !isLive(row.expiresAt),
  };
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Turns the link on, or changes its settings when it already is. */
export async function saveLink(user: Actor, input: z.infer<typeof linkInput>) {
  await editableItem(user, input.itemId);
  await env.DB.prepare(
    `INSERT INTO links (token, item_id, allow_download, expires_at, created_by) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(item_id) DO UPDATE SET allow_download = ?3, expires_at = ?4`,
  )
    .bind(
      newToken(),
      input.itemId,
      input.allowDownload ? 1 : 0,
      endOfDay(input.expires),
      user.id,
    )
    .run();
}

export async function deleteLink(user: Actor, itemId: string) {
  await editableItem(user, itemId);
  await env.DB.prepare("DELETE FROM links WHERE item_id = ?1")
    .bind(itemId)
    .run();
}

/**
 * What a view link shows: the linked item, or something inside it. Null for
 * an unknown, expired or turned-off link, or anything outside the item.
 */
export async function resolveLink(token: string, targetId?: string | null) {
  const link = await env.DB.prepare(
    `SELECT ${LINK_COLUMNS} FROM links WHERE token = ?1`,
  )
    .bind(token)
    .first<LinkRow>();
  if (!link || !isLive(link.expiresAt)) return null;
  const chain = await chainOf(targetId || link.itemId);
  const at = chain.findIndex((i) => i.id === link.itemId);
  if (at < 0) return null;
  // Nothing in the trash, from the top down to the target.
  if (chain.some((i) => i.trashedAt)) return null;
  const path = chain.slice(0, at + 1).reverse();
  return {
    link: { ...link, allowDownload: !!link.allowDownload },
    target: chain[0]!,
    path,
  };
}

export async function publicView(token: string, targetId?: string | null) {
  const found = await resolveLink(token, targetId);
  if (!found) return null;
  const { target, path, link } = found;
  let children: Pick<ItemRow, "id" | "name" | "kind" | "size" | "updatedAt">[] =
    [];
  let text: string | null = null;
  if (target.kind === "folder") {
    const { results } = await env.DB.prepare(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE parent_id = ?1 AND trashed_at IS NULL ORDER BY kind DESC, name`,
    )
      .bind(target.id)
      .all<ItemRow>();
    children = results.map(({ id, name, kind, size, updatedAt }) => ({
      id,
      name,
      kind,
      size,
      updatedAt,
    }));
  } else if (
    previewKind(target.mimeType, target.name) === "text" &&
    target.objectKey
  ) {
    text = await readText(target.objectKey);
  }
  return {
    allowDownload: link.allowDownload,
    item: {
      id: target.id,
      name: target.name,
      kind: target.kind,
      mimeType: target.mimeType,
      size: target.size,
      updatedAt: target.updatedAt,
    },
    path: path.map((p) => ({ id: p.id, name: p.name })),
    children,
    text,
  };
}
