import { createFileRoute } from "@tanstack/react-router";
import { getAccess } from "@/server/access";
import { memberOf, serveFile } from "@/server/serve";

export const Route = createFileRoute("/api/files/$fileId/raw")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { fileId: string };
      }) => {
        const user = await memberOf(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const access = await getAccess(user, params.fileId);
        if (!access) return new Response("Not found", { status: 404 });
        const download = new URL(request.url).searchParams.has("download");
        return serveFile(request, access.item, download);
      },
    },
  },
});
