// Pure rules shared by the server and the pages.
export type Role = "owner" | "editor" | "commenter" | "viewer";
export type ShareRole = Exclude<Role, "owner">;
export const SHARE_ROLES: ShareRole[] = ["viewer", "commenter", "editor"];

const RANK: Record<Role, number> = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  owner: 4,
};

export function maxRole(a: Role | null, b: Role | null): Role | null {
  if (!a) return b;
  if (!b) return a;
  return RANK[a] >= RANK[b] ? a : b;
}

export const canEdit = (role: Role | null) => !!role && RANK[role] >= 3;
export const canComment = (role: Role | null) => !!role && RANK[role] >= 2;

export type TypeGroup =
  | "folder"
  | "document"
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "other";
export const TYPE_GROUPS: TypeGroup[] = [
  "folder",
  "document",
  "image",
  "pdf",
  "video",
  "audio",
  "other",
];

const DOC_EXT = /\.(txt|md|csv|json|log|rtf|docx?|odt|xlsx?|ods|pptx?|odp)$/i;

export function typeGroup(
  kind: "file" | "folder",
  mime: string | null,
  name: string,
): TypeGroup {
  if (kind === "folder") return "folder";
  const m = (mime ?? "").toLowerCase();
  if (m === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (
    m.startsWith("text/") ||
    m.includes("document") ||
    m.includes("sheet") ||
    m.includes("presentation") ||
    m === "application/json" ||
    m === "application/msword" ||
    DOC_EXT.test(name)
  )
    return "document";
  return "other";
}

type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "none";

const INLINE_IMAGES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
]);
const TEXT_EXT = /\.(txt|md|csv|json|log|ya?ml|tsv)$/i;

/** How a file shows in the browser; types that could run script never show inline. */
export function previewKind(mime: string | null, name: string): PreviewKind {
  const m = (mime ?? "").toLowerCase().split(";")[0]!.trim();
  if (INLINE_IMAGES.has(m)) return "image";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (
    m === "text/plain" ||
    m === "text/markdown" ||
    m === "text/csv" ||
    m === "application/json" ||
    TEXT_EXT.test(name)
  )
    return "text";
  return "none";
}

/** The content type the raw route may serve inline, or null for attachment only. */
export function inlineType(mime: string | null, name: string): string | null {
  const kind = previewKind(mime, name);
  if (kind === "none") return null;
  if (kind === "text") return "text/plain; charset=utf-8";
  return (mime ?? "").split(";")[0]!.trim();
}

export function cleanName(name: string): string | null {
  const n = name.trim().replace(/[\u0000-\u001f/\\]/g, "");
  if (!n || n.length > 255) return null;
  return n;
}

/** A date input's value as the end of that day (UTC), or null. */
export function endOfDay(date: string | null | undefined): string | null {
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  return `${date}T23:59:59.999Z`;
}

export function isLive(expiresAt: string | null, now = new Date()): boolean {
  return !expiresAt || expiresAt > now.toISOString();
}
