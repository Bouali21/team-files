import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as comments from "@/server/comments";
import * as links from "@/server/links";
import * as sharing from "@/server/sharing";
import { memberMiddleware } from "./middleware";

const parse =
  <T>(schema: z.ZodType<T>) =>
  (data: unknown) =>
    schema.parse(data);
const item = z.object({ itemId: z.string().min(1) }).strict();

export const getShares = createServerFn()
  .middleware([memberMiddleware])
  .validator(parse(item))
  .handler(({ data, context }) =>
    sharing.listShares(context.user, data.itemId),
  );

export const addShare = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(sharing.addShareInput))
  .handler(({ data, context }) => sharing.addShare(context.user, data));

export const updateShare = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(sharing.updateShareInput))
  .handler(({ data, context }) => sharing.updateShare(context.user, data));

export const removeShare = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(sharing.shareIdInput))
  .handler(({ data, context }) =>
    sharing.removeShare(context.user, data.shareId),
  );

export const transferOwnership = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(sharing.shareIdInput))
  .handler(({ data, context }) =>
    sharing.transferOwnership(context.user, data.shareId),
  );

export const getLink = createServerFn()
  .middleware([memberMiddleware])
  .validator(parse(item))
  .handler(({ data, context }) => links.getLink(context.user, data.itemId));

export const saveLink = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(links.linkInput))
  .handler(({ data, context }) => links.saveLink(context.user, data));

export const deleteLink = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(item))
  .handler(({ data, context }) => links.deleteLink(context.user, data.itemId));

export const getComments = createServerFn()
  .middleware([memberMiddleware])
  .validator(parse(item))
  .handler(({ data, context }) =>
    comments.listComments(context.user, data.itemId),
  );

export const addComment = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(comments.addCommentInput))
  .handler(({ data, context }) => comments.addComment(context.user, data));

export const editComment = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(comments.editCommentInput))
  .handler(({ data, context }) => comments.editComment(context.user, data));

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator(parse(comments.commentIdInput))
  .handler(({ data, context }) =>
    comments.deleteComment(context.user, data.id),
  );
