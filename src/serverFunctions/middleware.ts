import { createMiddleware } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { rememberUser } from "@/server/access";
import { NotFound } from "@/server/items";

/** The signed-in member, recorded on first sight; a missing item becomes the page's not-found. */
export const memberMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context }) => {
    await rememberUser(context.user);
    try {
      return await next();
    } catch (error) {
      if (error instanceof NotFound) throw notFound();
      throw error;
    }
  });
