import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { z } from "zod";
import * as admin from "@/server/admin";
import { memberMiddleware } from "./middleware";

export const getAdmin = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context }) => {
    if (!isAdmin(context.user)) return { allowed: false as const };
    const [storage, links] = await Promise.all([
      admin.storageByMember(),
      admin.activeLinks(),
    ]);
    return { allowed: true as const, storage, links };
  });

export const revokeAnyLink = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) =>
    z
      .object({ token: z.string().min(1) })
      .strict()
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!isAdmin(context.user)) throw new Error("Only admins can do this.");
    await admin.revokeLink(data.token);
  });
