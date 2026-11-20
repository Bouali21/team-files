import { env } from "cloudflare:workers";
import { nowIso } from "./access";

export async function storageByMember() {
  const { results } = await env.DB.prepare(
    `SELECT u.email, COALESCE(SUM(i.size), 0) AS bytes, COUNT(i.id) AS files
     FROM users u LEFT JOIN items i ON i.owner_id = u.id AND i.kind = 'file'
     GROUP BY u.id ORDER BY bytes DESC, u.email`,
  ).all<{ email: string; bytes: number; files: number }>();
  return results;
}

export async function activeLinks() {
  const { results } = await env.DB.prepare(
    `SELECT l.token, l.allow_download AS allowDownload, l.expires_at AS expiresAt, l.created_at AS createdAt,
       i.name, i.kind, COALESCE(u.email, '') AS ownerEmail
     FROM links l JOIN items i ON i.id = l.item_id LEFT JOIN users u ON u.id = i.owner_id
     WHERE l.expires_at IS NULL OR l.expires_at > ?1 ORDER BY l.created_at DESC`,
  )
    .bind(nowIso())
    .all<{
      token: string;
      allowDownload: number;
      expiresAt: string | null;
      createdAt: string;
      name: string;
      kind: string;
      ownerEmail: string;
    }>();
  return results.map((r) => ({ ...r, allowDownload: !!r.allowDownload }));
}

export async function revokeLink(token: string) {
  await env.DB.prepare("DELETE FROM links WHERE token = ?1").bind(token).run();
}
