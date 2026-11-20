import { createFileRoute } from "@tanstack/react-router";
import { uploadFiles } from "@/server/items";
import { crossSite, failure, memberOf } from "@/server/serve";

// Upload: multipart form with `file` (one or more) and an optional `parentId`.
export const Route = createFileRoute("/api/files/")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (crossSite(request))
          return new Response("Forbidden", { status: 403 });
        const user = await memberOf(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const form = await request.formData().catch(() => null);
        if (!form)
          return Response.json(
            { error: "Send a multipart form." },
            { status: 400 },
          );
        const files = form
          .getAll("file")
          .filter((f): f is File => f instanceof File);
        if (files.length === 0)
          return Response.json({ error: "No files." }, { status: 400 });
        const parent = form.get("parentId");
        try {
          const items = await uploadFiles(
            user,
            typeof parent === "string" && parent ? parent : null,
            files,
          );
          return Response.json({ items }, { status: 201 });
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
