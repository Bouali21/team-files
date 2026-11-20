import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import { publicView } from "@/server/links";

// A view link's page. No member needed: the token is the check.
export const getPublicView = createServerFn()
  .validator((data: unknown) =>
    z
      .object({
        token: z.string().min(1).max(100),
        id: z.string().max(64).nullable(),
      })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const view = await publicView(data.token, data.id);
    if (!view) throw notFound();
    return view;
  });
