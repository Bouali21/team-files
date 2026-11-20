import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  ACCESSIBLE,
  ITEM_COLUMNS,
  getAccess,
  nowIso,
  type Actor,
  type ItemRow,
} from "./access";
import {
  canEdit,
  cleanName,
  maxRole,
  previewKind,
  TYPE_GROUPS,
  typeGroup,
  type Role,
  type TypeGroup,
} from "./roles";

export class NotFound extends Error {
  constructor(what = "Not found") {
    super(what);
  }
}
export class Refused extends Error {}

export interface ListedItem {
  id: string;
  name: string;
  kind: "file" | "folder";
  mimeType: string | null;
  size: number;
  ownerEmail: string;
  ownedByMe: boolean;
  updatedAt: string;
  trashedAt: string | null;
  role: Role;
  starred: boolean;
  group: TypeGroup;
}

const name = z
  .string()
  .max(255)
  .transform((v, ctx) => {
    const n = cleanName(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Enter a name." });
      return z.NEVER;
    }
    return n;
  });
const id = z.string().min(1).max(64);

export const createFolderInput = z
  .object({ name, parentId: id.nullable().optional() })
  .strict();
export const renameInput = z.object({ id, name }).strict();
export const moveInput = z.object({ id, parentId: id.nullable() }).strict();
export const itemInput = z.object({ id }).strict();
export const searchInput = z
  .object({
    q: z.string().max(200).optional(),
    type: z.enum(TYPE_GROUPS as [TypeGroup, ...TypeGroup[]]).optional(),
  })
  .strict();

async function annotate(
  user: Actor,
  rows: ItemRow[],
  roleOf: (row: ItemRow) => Role | Promise<Role | null>,
): Promise<ListedItem[]> {
  if (rows.length === 0) return [];
  const ids = JSON.stringify(rows.map((r) => r.id));
  const owners = JSON.stringify([...new Set(rows.map((r) => r.ownerId))]);
  const [emails, starred] = await env.DB.batch<{ k: string; v: string }>([
    env.DB.prepare(
      "SELECT id AS k, email AS v FROM users WHERE id IN (SELECT value FROM json_each(?1))",
    ).bind(owners),
    env.DB.prepare(
      "SELECT item_id AS k, '' AS v FROM stars WHERE user_id = ?1 AND item_id IN (SELECT value FROM json_each(?2))",
    ).bind(user.id, ids),
  ]);
  const emailOf = new Map(emails!.results.map((r) => [r.k, r.v]));
  const starSet = new Set(starred!.results.map((r) => r.k));
  const out: ListedItem[] = [];
  for (const r of rows) {
    const role = await roleOf(r);
    if (!role) continue;
    out.push({
      id: r.id,
      name: r.name,
      kind: r.kind,
      mimeType: r.mimeType,
      size: r.size,
      ownerEmail: emailOf.get(r.ownerId) ?? "",
      ownedByMe: r.ownerId === user.id,
      updatedAt: r.updatedAt,
      trashedAt: r.trashedAt,
      role,
      starred: starSet.has(r.id),
      group: typeGroup(r.kind, r.mimeType, r.name),
    });
  }
  return out;
}

/** Roles for a list of items each looked up on its own. */
const lookUp = (user: Actor) => async (r: ItemRow) =>
  (await getAccess(user, r.id))?.role ?? null;

export async function listFolder(user: Actor, folderId: string | null) {
  if (folderId === null) {
    const { results } = await env.DB.prepare(
      `SELECT ${ITEM_COLUMNS} FROM items WHERE owner_id = ?1 AND parent_id IS NULL AND trashed_at IS NULL`,
    )
      .bind(user.id)
      .all<ItemRow>();
    return {
      folder: null,
      role: "owner" as Role,
      path: [],
      inOwnSpace: true,
      items: await annotate(user, results, () => "owner"),
    };
  }
  const access = await getAccess(user, folderId);
  if (!access || access.item.kind !== "folder") throw new NotFound();
  const { results } = await env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE parent_id = ?1 AND trashed_at IS NULL`,
  )
    .bind(folderId)
    .all<ItemRow>();
  const inherited: Role = access.role === "owner" ? "editor" : access.role;
  const { results: direct } = await env.DB.prepare(
    `SELECT item_id AS itemId, role FROM shares WHERE email = ?1
     AND (expires_at IS NULL OR expires_at > ?2)
     AND item_id IN (SELECT id FROM items WHERE parent_id = ?3)`,
  )
    .bind(user.email.toLowerCase(), nowIso(), folderId)
    .all<{ itemId: string; role: Role }>();
  const items = await annotate(user, results, (r) => {
    if (r.ownerId === user.id) return "owner";
    let role: Role | null = inherited;
    for (const d of direct) if (d.itemId === r.id) role = maxRole(role, d.role);
    return role!;
  });
  return {
    folder: { id: access.item.id, name: access.item.name },
    role: access.role,
    path: access.path.map((p) => ({ id: p.id, name: p.name })),
    inOwnSpace: access.inOwnSpace,
    items,
  };
}

export async function getFile(user: Actor, fileId: string) {
  const access = await getAccess(user, fileId);
  if (!access || access.item.kind !== "file") throw new NotFound();
  const [listed] = await annotate(user, [access.item], () => access.role);
  const { objectKey, mimeType, name } = access.item;
  const text =
    objectKey && previewKind(mimeType, name) === "text"
      ? await readText(objectKey)
      : null;
  return {
    item: listed!,
    text,
    path: access.path.slice(0, -1).map((p) => ({ id: p.id, name: p.name })),
    inOwnSpace: access.inOwnSpace,
  };
}

/** Checks the member can add to this folder (null: their own top level). */
async function editableFolder(user: Actor, parentId: string | null) {
  if (parentId === null) return;
  const access = await getAccess(user, parentId);
  if (!access || access.item.kind !== "folder" || !canEdit(access.role))
    throw new NotFound();
}

export async function createFolder(
  user: Actor,
  input: z.infer<typeof createFolderInput>,
) {
  const parentId = input.parentId ?? null;
  await editableFolder(user, parentId);
  const folderId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO items (id, owner_id, parent_id, kind, name) VALUES (?1, ?2, ?3, 'folder', ?4)",
  )
    .bind(folderId, user.id, parentId, input.name)
    .run();
  return { id: folderId, name: input.name };
}

export async function uploadFiles(
  user: Actor,
  parentId: string | null,
  files: File[],
) {
  await editableFolder(user, parentId);
  const created: { id: string; name: string; size: number }[] = [];
  for (const file of files) {
    const fileName = cleanName(file.name) ?? "Untitled";
    const fileId = crypto.randomUUID();
    const key = `objects/${fileId}`;
    const type = file.type || "application/octet-stream";
    await env.files.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: type },
    });
    await env.DB.prepare(
      `INSERT INTO items (id, owner_id, parent_id, kind, name, mime_type, size, object_key)
       VALUES (?1, ?2, ?3, 'file', ?4, ?5, ?6, ?7)`,
    )
      .bind(fileId, user.id, parentId, fileName, type, file.size, key)
      .run();
    created.push({ id: fileId, name: fileName, size: file.size });
  }
  return created;
}

async function editable(user: Actor, itemId: string) {
  const access = await getAccess(user, itemId);
  if (!access) throw new NotFound();
  if (!canEdit(access.role)) throw new Refused("You can't change this item.");
  return access;
}

export async function rename(user: Actor, input: z.infer<typeof renameInput>) {
  await editable(user, input.id);
  await env.DB.prepare(
    "UPDATE items SET name = ?1, updated_at = ?2 WHERE id = ?3",
  )
    .bind(input.name, nowIso(), input.id)
    .run();
}

export async function move(user: Actor, input: z.infer<typeof moveInput>) {
  const access = await editable(user, input.id);
  if (input.parentId === null) {
    if (access.role !== "owner")
      throw new Refused("Only the owner can move this to their own files.");
  } else {
    const dest = await getAccess(user, input.parentId);
    if (!dest || dest.item.kind !== "folder" || !canEdit(dest.role))
      throw new NotFound();
    if (dest.path.some((p) => p.id === input.id) || input.parentId === input.id)
      throw new Refused("A folder can't go inside itself.");
    // getAccess's path may start below the item; check the whole chain.
    const { results } = await env.DB.prepare(
      `WITH RECURSIVE up(id, parent_id) AS (
         SELECT id, parent_id FROM items WHERE id = ?1
         UNION ALL SELECT i.id, i.parent_id FROM items i JOIN up ON i.id = up.parent_id
       ) SELECT id FROM up WHERE id = ?2`,
    )
      .bind(input.parentId, input.id)
      .all();
    if (results.length) throw new Refused("A folder can't go inside itself.");
  }
  await env.DB.prepare(
    "UPDATE items SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
  )
    .bind(input.parentId, nowIso(), input.id)
    .run();
}

/** Folders this member can put things in, with their paths, for the move picker. */
export async function moveTargets(user: Actor, itemId: string) {
  await editable(user, itemId);
  const { results } = await env.DB.prepare(
    `WITH RECURSIVE ${ACCESSIBLE},
     below(id) AS (
       SELECT ?4 UNION ALL SELECT i.id FROM items i JOIN below b ON i.parent_id = b.id
     )
     SELECT ${ITEM_COLUMNS} FROM items
     WHERE kind = 'folder' AND id IN (SELECT id FROM acc) AND id NOT IN (SELECT id FROM below)
     LIMIT 300`,
  )
    .bind(user.id, user.email.toLowerCase(), nowIso(), itemId)
    .all<ItemRow>();
  const out: { id: string; label: string }[] = [];
  for (const r of results) {
    const a = await getAccess(user, r.id);
    if (!a || !canEdit(a.role)) continue;
    const root = a.inOwnSpace ? "My files" : "Shared with me";
    out.push({
      id: r.id,
      label: [root, ...a.path.map((p) => p.name)].join(" / "),
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export async function trash(user: Actor, itemId: string) {
  await editable(user, itemId);
  await env.DB.prepare("UPDATE items SET trashed_at = ?1 WHERE id = ?2")
    .bind(nowIso(), itemId)
    .run();
}

export async function listTrash(user: Actor) {
  const { results } = await env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE owner_id = ?1 AND trashed_at IS NOT NULL ORDER BY trashed_at DESC`,
  )
    .bind(user.id)
    .all<ItemRow>();
  return annotate(user, results, () => "owner");
}

async function ownedTrashed(user: Actor, itemId: string) {
  const row = await env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE id = ?1 AND owner_id = ?2 AND trashed_at IS NOT NULL`,
  )
    .bind(itemId, user.id)
    .first<ItemRow>();
  if (!row) throw new NotFound();
  return row;
}

export async function restore(user: Actor, itemId: string) {
  const row = await ownedTrashed(user, itemId);
  let parentId = row.parentId;
  // Back to the owner's top level when its folder is gone or out of reach.
  if (parentId) {
    const parent = await getAccess(user, parentId);
    if (!parent || !canEdit(parent.role)) parentId = null;
  }
  await env.DB.prepare(
    "UPDATE items SET trashed_at = NULL, parent_id = ?1, updated_at = ?2 WHERE id = ?3",
  )
    .bind(parentId, nowIso(), itemId)
    .run();
}

export async function deleteForever(user: Actor, itemId: string) {
  await ownedTrashed(user, itemId);
  await destroy(itemId);
}

/** Deletes an item, everything inside it, their bytes and every record about them. */
async function destroy(itemId: string) {
  const { results } = await env.DB.prepare(
    `WITH RECURSIVE below(id) AS (
       SELECT ?1 UNION ALL SELECT i.id FROM items i JOIN below b ON i.parent_id = b.id
     ) SELECT items.id AS id, object_key AS objectKey FROM items JOIN below USING (id)`,
  )
    .bind(itemId)
    .all<{ id: string; objectKey: string | null }>();
  const keys = results.flatMap((r) => (r.objectKey ? [r.objectKey] : []));
  for (let i = 0; i < keys.length; i += 1000)
    await env.files.delete(keys.slice(i, i + 1000));
  const ids = JSON.stringify(results.map((r) => r.id));
  const inIds = "IN (SELECT value FROM json_each(?1))";
  await env.DB.batch(
    ["shares", "links", "comments", "stars"]
      .map((t) =>
        env.DB.prepare(`DELETE FROM ${t} WHERE item_id ${inIds}`).bind(ids),
      )
      .concat(env.DB.prepare(`DELETE FROM items WHERE id ${inIds}`).bind(ids)),
  );
}

/** Empties what has been in the trash for 30 days. */
export async function purgeTrash(now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const { results } = await env.DB.prepare(
    "SELECT id FROM items WHERE trashed_at IS NOT NULL AND trashed_at < ?1",
  )
    .bind(cutoff)
    .all<{ id: string }>();
  for (const r of results) {
    const still = await env.DB.prepare("SELECT 1 FROM items WHERE id = ?1")
      .bind(r.id)
      .first();
    if (still) await destroy(r.id);
  }
}

export async function setStar(user: Actor, itemId: string, on: boolean) {
  if (!(await getAccess(user, itemId))) throw new NotFound();
  await env.DB.prepare(
    on
      ? "INSERT OR IGNORE INTO stars (user_id, item_id) VALUES (?1, ?2)"
      : "DELETE FROM stars WHERE user_id = ?1 AND item_id = ?2",
  )
    .bind(user.id, itemId)
    .run();
}

async function accessibleWhere(
  user: Actor,
  where: string,
  tail: string,
  extra: unknown[] = [],
) {
  const { results } = await env.DB.prepare(
    `WITH RECURSIVE ${ACCESSIBLE}
     SELECT ${ITEM_COLUMNS} FROM items WHERE id IN (SELECT id FROM acc) AND ${where} ${tail}`,
  )
    .bind(user.id, user.email.toLowerCase(), nowIso(), ...extra)
    .all<ItemRow>();
  return annotate(user, results, lookUp(user));
}

export async function search(user: Actor, input: z.infer<typeof searchInput>) {
  const q = (input.q ?? "").trim().toLowerCase();
  const rows = await accessibleWhere(
    user,
    "instr(lower(name), ?4) > 0",
    "ORDER BY updated_at DESC LIMIT 500",
    [q],
  );
  return (input.type ? rows.filter((r) => r.group === input.type) : rows).slice(
    0,
    100,
  );
}

export const recent = (user: Actor) =>
  accessibleWhere(user, "1 = 1", "ORDER BY updated_at DESC LIMIT 50");

export const starred = (user: Actor) =>
  accessibleWhere(
    user,
    "id IN (SELECT item_id FROM stars WHERE user_id = ?1)",
    "ORDER BY name",
  );

export async function sharedWithMe(user: Actor) {
  const { results } = await env.DB.prepare(
    `SELECT ${ITEM_COLUMNS} FROM items WHERE owner_id <> ?1 AND id IN (
       SELECT item_id FROM shares WHERE email = ?2 AND (expires_at IS NULL OR expires_at > ?3)
     ) ORDER BY updated_at DESC`,
  )
    .bind(user.id, user.email.toLowerCase(), nowIso())
    .all<ItemRow>();
  return annotate(user, results, lookUp(user));
}

export async function storageUsed(user: Actor): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(size), 0) AS n FROM items WHERE owner_id = ?1 AND kind = 'file'",
  )
    .bind(user.id)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** The first bytes of a text file, for its preview. */
export async function readText(objectKey: string): Promise<string> {
  const obj = await env.files.get(objectKey, {
    range: { offset: 0, length: 200_000 },
  });
  return obj ? await obj.text() : "";
}
