import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// One row per member the app has seen, keyed by the Gateway's user id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

// Files and folders. A null parent is the owner's top level.
export const items = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    parentId: text("parent_id"),
    kind: text("kind", { enum: ["file", "folder"] }).notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type"),
    size: integer("size").notNull().default(0),
    // R2 object key; files only.
    objectKey: text("object_key"),
    trashedAt: text("trashed_at"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    index("items_parent").on(t.parentId),
    index("items_owner").on(t.ownerId),
  ],
);

// Access given to a member by email.
export const shares = sqliteTable(
  "shares",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: ["viewer", "commenter", "editor"] }).notNull(),
    expiresAt: text("expires_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("shares_item_email").on(t.itemId, t.email),
    index("shares_email").on(t.email),
  ],
);

// View links anyone may open. One per item; removing the row turns it off.
export const links = sqliteTable(
  "links",
  {
    token: text("token").primaryKey(),
    itemId: text("item_id").notNull(),
    allowDownload: integer("allow_download", { mode: "boolean" })
      .notNull()
      .default(false),
    expiresAt: text("expires_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("links_item").on(t.itemId)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("comments_item").on(t.itemId)],
);

export const stars = sqliteTable(
  "stars",
  {
    userId: text("user_id").notNull(),
    itemId: text("item_id").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);
