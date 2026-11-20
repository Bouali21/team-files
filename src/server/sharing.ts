import { env } from "cloudflare:workers";
import { z } from "zod";
import { getAccess, nowIso, type Actor } from "./access";
import { NotFound, Refused } from "./items";
import {
  canEdit,
  endOfDay,
  isLive,
  SHARE_ROLES,
  type ShareRole,
} from "./roles";

const role = z.enum(SHARE_ROLES as [ShareRole, ...ShareRole[]]);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const addShareInput = z
  .object({
    itemId: z.string().min(1),
    email: z.string().trim().toLowerCase().email("Enter an email address."),
    role,
    expires: date,
  })
  .strict();
export const updateShareInput = z
  .object({ shareId: z.string().min(1), role: role.optional(), expires: date })
  .strict();
export const shareIdInput = z.object({ shareId: z.string().min(1) }).strict();

async function editableItem(user: Actor, itemId: string) {
  const access = await getAccess(user, itemId);
  if (!access) throw new NotFound();
  if (!canEdit(access.role)) throw new Refused("You can't share this item.");
  return access;
}

export async function listShares(user: Actor, itemId: string) {
  const access = await editableItem(user, itemId);
  const [owner, shares] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare("SELECT email FROM users WHERE id = ?1").bind(
      access.item.ownerId,
    ),
    env.DB.prepare(
      `SELECT s.id, s.email, s.role, s.expires_at AS expiresAt, u.id AS userId FROM shares s
       LEFT JOIN users u ON u.email = s.email WHERE s.item_id = ?1 ORDER BY s.created_at`,
    ).bind(itemId),
  ]);
  return {
    ownerEmail: (owner!.results[0]?.email as string) ?? "",
    isOwner: access.role === "owner",
    shares: (
      shares!.results as {
        id: string;
        email: string;
        role: ShareRole;
        expiresAt: string | null;
        userId: string | null;
      }[]
    ).map((s) => ({
      id: s.id,
      email: s.email,
      role: s.role,
      expires: s.expiresAt ? s.expiresAt.slice(0, 10) : null,
      expired: !isLive(s.expiresAt),
      // Ownership goes only to someone who has opened the app.
      canBecomeOwner: !!s.userId,
    })),
  };
}

export async function addShare(
  user: Actor,
  input: z.infer<typeof addShareInput>,
) {
  const access = await editableItem(user, input.itemId);
  const owner = await env.DB.prepare("SELECT email FROM users WHERE id = ?1")
    .bind(access.item.ownerId)
    .first<{ email: string }>();
  if (owner?.email === input.email)
    throw new Refused("That person owns this item.");
  await env.DB.prepare(
    `INSERT INTO shares (id, item_id, email, role, expires_at, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(item_id, email) DO UPDATE SET role = ?4, expires_at = ?5`,
  )
    .bind(
      crypto.randomUUID(),
      input.itemId,
      input.email,
      input.role,
      endOfDay(input.expires),
      user.id,
    )
    .run();
}

async function shareFor(user: Actor, shareId: string) {
  const share = await env.DB.prepare(
    "SELECT item_id AS itemId, email FROM shares WHERE id = ?1",
  )
    .bind(shareId)
    .first<{ itemId: string; email: string }>();
  if (!share) throw new NotFound();
  const access = await editableItem(user, share.itemId);
  return { share, access };
}

export async function updateShare(
  user: Actor,
  input: z.infer<typeof updateShareInput>,
) {
  await shareFor(user, input.shareId);
  if (input.role)
    await env.DB.prepare("UPDATE shares SET role = ?1 WHERE id = ?2")
      .bind(input.role, input.shareId)
      .run();
  if (input.expires !== undefined)
    await env.DB.prepare("UPDATE shares SET expires_at = ?1 WHERE id = ?2")
      .bind(endOfDay(input.expires), input.shareId)
      .run();
}

export async function removeShare(user: Actor, shareId: string) {
  await shareFor(user, shareId);
  await env.DB.prepare("DELETE FROM shares WHERE id = ?1").bind(shareId).run();
}

/** Gives the item to the person on this share; the old owner keeps edit access. */
export async function transferOwnership(user: Actor, shareId: string) {
  const { share, access } = await shareFor(user, shareId);
  if (access.role !== "owner") throw new Refused("Only the owner can do this.");
  const target = await env.DB.prepare("SELECT id FROM users WHERE email = ?1")
    .bind(share.email)
    .first<{ id: string }>();
  if (!target) throw new Refused("They need to open Team Files once first.");
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE items SET owner_id = ?1, updated_at = ?2 WHERE id = ?3",
    ).bind(target.id, nowIso(), share.itemId),
    env.DB.prepare("DELETE FROM shares WHERE id = ?1").bind(shareId),
    env.DB.prepare(
      `INSERT INTO shares (id, item_id, email, role, created_by) VALUES (?1, ?2, ?3, 'editor', ?4)
       ON CONFLICT(item_id, email) DO UPDATE SET role = 'editor', expires_at = NULL`,
    ).bind(
      crypto.randomUUID(),
      share.itemId,
      user.email.toLowerCase(),
      user.id,
    ),
  ]);
}
