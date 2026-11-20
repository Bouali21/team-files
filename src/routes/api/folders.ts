import { createFileRoute } from "@tanstack/react-router";
import { createFolder, createFolderInput } from "@/server/items";
import { crossSite, failure, memberOf } from "@/server/serve";

export const Route = createFileRoute("/api/folders")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (
          crossSite(request) ||
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          return new Response("Forbidden", { status: 403 });
        const user = await memberOf(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        try {
          const input = createFolderInput.parse(await request.json());
          return Response.json(await createFolder(user, input), {
            status: 201,
          });
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
