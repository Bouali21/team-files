import { createFileRoute } from "@tanstack/react-router";
import { FolderPage } from "@/client/components/files/FolderPage";
import { getFolder } from "@/serverFunctions/files";

export const Route = createFileRoute("/")({
  loader: () => getFolder({ data: { folderId: null } }),
  head: () => ({ meta: [{ title: "My files · Team Files" }] }),
  component: () => <FolderPage data={Route.useLoaderData()} />,
});
