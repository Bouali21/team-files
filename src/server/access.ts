import { env } from "cloudflare:workers";
import { isLive, maxRole, type Role } from "./roles";

export interface Actor {
  id: string;
  email: string;
}

export interface ItemRow {
  id: string;
  ownerId: string;
  parentId: string | null;
  kind: "file" | "folder";
  name: string;
  mimeType: string | null;
  size: number;
  objectKey: string | null;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const ITEM_COLUMNS = `id, owner_id AS ownerId, parent_id AS parentId, kind, name,
  mime_type AS mimeType, size, object_key AS objectKey, trashed_at AS trashedAt,
  created_at AS createdAt, updated_at AS updatedAt`;

export const nowIso = () => new Date().toISOString();

/** Records the member on first sight and keeps their email current. */
export async function rememberUser(user: Actor): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, email) VALUES (?1, ?2)
     ON CONFLICT(id) DO UPDATE SET email = ?2 WHERE email <> ?2`,
  )
    .bind(user.id, user.email.toLowerCase())
    .run();
}

/** The item first, then each folder above it up to the top. */
export async function chainOf(itemId: string): Promise<ItemRow[]> {
  const { results } = await env.DB.prepare(
    `WITH RECURSIVE chain(cid, pid, depth) AS (
       SELECT id, parent_id, 0 FROM items WHERE id = ?1
       UNION ALL
       SELECT i.id, i.parent_id, c.depth + 1 FROM items i JOIN chain c ON i.id = c.pid
       WHERE c.depth < 100
     )
     SELECT ${ITEM_COLUMNS} FROM items JOIN chain ON items.id = chain.cid ORDER BY chain.depth`,
  )
    .bind(itemId)
    .all<ItemRow>();
  return results;
}

interface Access {
  item: ItemRow;
  role: Role;
  /** From the topmost folder this member can open down to the item. */
  path: ItemRow[];
  /** Whether the path starts at the member's own top level. */
  inOwnSpace: boolean;
}

/**
 * What this member may do with an item: owner, a live share on it or a
 * folder above it, or owning a folder above it (editor). Null when none, or
 * when it or a folder above it is in the trash.
 */
export async function getAccess(
  user: Actor,
  itemId: string,
): Promise<Access | null> {
  const chain = await chainOf(itemId);
  if (chain.length === 0 || chain.some((i) => i.trashedAt)) return null;
  const ids = chain.map((i) => i.id);
  const { results: grants } = await env.DB.prepare(
    `SELECT item_id AS itemId, role, expires_at AS expiresAt FROM shares
     WHERE email = ?1 AND item_id IN (SELECT value FROM json_each(?2))`,
  )
    .bind(user.email.toLowerCase(), JSON.stringify(ids))
    .all<{ itemId: string; role: Role; expiresAt: string | null }>();
  const live = grants.filter((g) => isLive(g.expiresAt));

  const item = chain[0]!;
  let role: Role | null = item.ownerId === user.id ? "owner" : null;
  for (const node of chain.slice(1)) {
    if (node.ownerId === user.id) role = maxRole(role, "editor");
  }
  for (const g of live) role = maxRole(role, g.role);
  if (!role) return null;

  // Walk down from the top; the path starts where access starts.
  const top = [...chain].reverse();
  const granted = new Set(live.map((g) => g.itemId));
  const start = top.findIndex(
    (n) => n.ownerId === user.id || granted.has(n.id),
  );
  const path = top.slice(Math.max(start, 0));
  return {
    item,
    role,
    path,
    inOwnSpace: start === 0 && top[0]!.ownerId === user.id,
  };
}

/** SQL for every live item this member can open: `acc(id)`. Binds ?1 user id, ?2 email, ?3 now. */
export const ACCESSIBLE = `
  alive(id) AS (
    SELECT id FROM items WHERE parent_id IS NULL AND trashed_at IS NULL
    UNION ALL
    SELECT i.id FROM items i JOIN alive a ON i.parent_id = a.id WHERE i.trashed_at IS NULL
  ),
  seed(id) AS (
    SELECT id FROM items WHERE owner_id = ?1
    UNION
    SELECT item_id FROM shares WHERE email = ?2 AND (expires_at IS NULL OR expires_at > ?3)
  ),
  acc(id) AS (
    SELECT id FROM seed WHERE id IN (SELECT id FROM alive)
    UNION
    SELECT i.id FROM items i JOIN acc a ON i.parent_id = a.id WHERE i.trashed_at IS NULL
  )`;
