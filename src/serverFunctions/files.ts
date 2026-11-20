import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as items from "@/server/items";
import { memberMiddleware } from "./middleware";

const folderId = z.object({ folderId: z.string().min(1).nullable() }).strict();
const parse =
  <T>(schema: z.ZodType<T>) =>
  (data: unknown) =>
    schema.parse(data);

export const getFolder = createServerFn()
  .middleware([memberMiddleware])
  .validator(parse(folderId))
  .handler(async ({ data, context }) => ({
    ...(await items.listFolder(context.user, data.folderId)),
    storage: data.folderId ? null : await items.storageUsed(context.user),
  }));

export const getFile = createServerFn()
  .middleware([memberMiddleware])
  .validator(parse(items.itemInput))
  .handler(({ data, context }) => items.getFile(context.user, data.id));

export const createFolder = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(items.createFolderInput))
  .handler(({ data, context }) => items.createFolder(context.user, data));

export const renameItem = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(items.renameInput))
  .handler(({ data, context }) => items.rename(context.user, data));

export const moveItem = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(items.moveInput))
  .handler(({ data, context }) => items.move(context.user, data));

export const getMoveTargets = createServerFn()
  .middleware([memberMiddleware])
  .validator(parse(items.itemInput))
  .handler(({ data, context }) => items.moveTargets(context.user, data.id));

export const trashItem = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(items.itemInput))
  .handler(({ data, context }) => items.trash(context.user, data.id));

export const restoreItem = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(items.itemInput))
  .handler(({ data, context }) => items.restore(context.user, data.id));

export const deleteForever = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(items.itemInput))
  .handler(({ data, context }) => items.deleteForever(context.user, data.id));

export const setStar = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(
    parse(z.object({ id: z.string().min(1), on: z.boolean() }).strict()),
  )
  .handler(({ data, context }) =>
    items.setStar(context.user, data.id, data.on),
  );

export const getTrash = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => items.listTrash(context.user));

export const getRecent = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => items.recent(context.user));

export const getStarred = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => items.starred(context.user));

export const getSharedWithMe = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context }) => items.sharedWithMe(context.user));

export const searchItems = createServerFn()
  .middleware([memberMiddleware])
  .validator(parse(items.searchInput))
  .handler(({ data, context }) => items.search(context.user, data));
