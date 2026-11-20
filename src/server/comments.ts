import { env } from "cloudflare:workers";
import { z } from "zod";
import { getAccess, nowIso, type Actor } from "./access";
import { NotFound, Refused } from "./items";
import { canComment } from "./roles";

const body = z.string().trim().min(1, "Write something first.").max(5000);
export const addCommentInput = z
  .object({ itemId: z.string().min(1), body })
  .strict();
export const editCommentInput = z
  .object({ id: z.string().min(1), body })
  .strict();
export const commentIdInput = z.object({ id: z.string().min(1) }).strict();

export async function listComments(user: Actor, itemId: string) {
  const access = await getAccess(user, itemId);
  if (!access) throw new NotFound();
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.body, c.created_at AS createdAt, c.updated_at AS updatedAt,
       c.author_id AS authorId, COALESCE(u.email, '') AS authorEmail
     FROM comments c LEFT JOIN users u ON u.id = c.author_id
     WHERE c.item_id = ?1 ORDER BY c.created_at, c.id`,
  )
    .bind(itemId)
    .all<{
      id: string;
      body: string;
      createdAt: string;
      updatedAt: string;
      authorId: string;
      authorEmail: string;
    }>();
  return {
    canPost: canComment(access.role),
    comments: results.map(({ authorId, ...c }) => ({
      ...c,
      edited: c.updatedAt !== c.createdAt,
      canEdit: authorId === user.id && canComment(access.role),
      canDelete: authorId === user.id || access.role === "owner",
    })),
  };
}

export async function addComment(
  user: Actor,
  input: z.infer<typeof addCommentInput>,
) {
  const access = await getAccess(user, input.itemId);
  if (!access || access.item.kind !== "file") throw new NotFound();
  if (!canComment(access.role))
    throw new Refused("You can only view this file.");
  await env.DB.prepare(
    "INSERT INTO comments (id, item_id, author_id, body) VALUES (?1, ?2, ?3, ?4)",
  )
    .bind(crypto.randomUUID(), input.itemId, user.id, input.body)
    .run();
}

async function commentFor(user: Actor, id: string) {
  const row = await env.DB.prepare(
    "SELECT item_id AS itemId, author_id AS authorId FROM comments WHERE id = ?1",
  )
    .bind(id)
    .first<{ itemId: string; authorId: string }>();
  if (!row) throw new NotFound();
  const access = await getAccess(user, row.itemId);
  if (!access) throw new NotFound();
  return { row, access };
}

export async function editComment(
  user: Actor,
  input: z.infer<typeof editCommentInput>,
) {
  const { row, access } = await commentFor(user, input.id);
  if (row.authorId !== user.id || !canComment(access.role))
    throw new Refused("You can only edit your own comments.");
  await env.DB.prepare(
    "UPDATE comments SET body = ?1, updated_at = ?2 WHERE id = ?3",
  )
    .bind(input.body, nowIso(), input.id)
    .run();
}

export async function deleteComment(user: Actor, id: string) {
  const { row, access } = await commentFor(user, id);
  if (row.authorId !== user.id && access.role !== "owner")
    throw new Refused("You can't delete this comment.");
  await env.DB.prepare("DELETE FROM comments WHERE id = ?1").bind(id).run();
}
