import { createFileRoute } from "@tanstack/react-router";
import { resolveLink } from "@/server/links";
import { inlineType } from "@/server/roles";
import { serveFile } from "@/server/serve";

// Public: the bytes of a file a view link covers.
export const Route = createFileRoute("/s/$token/raw/$fileId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { token: string; fileId: string };
      }) => {
        const found = await resolveLink(params.token, params.fileId);
        if (!found) return new Response("Not found", { status: 404 });
        const download = new URL(request.url).searchParams.has("download");
        const { mimeType, name } = found.target;
        if (
          !found.link.allowDownload &&
          (download || !inlineType(mimeType, name))
        )
          return new Response("Not found", { status: 404 });
        return serveFile(request, found.target, download);
      },
    },
  },
});
