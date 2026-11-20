import { createFileRoute } from "@tanstack/react-router";
import { FolderPage, NotFoundPage } from "@/client/components/files/FolderPage";
import { getFolder } from "@/serverFunctions/files";

export const Route = createFileRoute("/folders/$folderId")({
  loader: ({ params }) => getFolder({ data: { folderId: params.folderId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.folder?.name ?? "Folder"} · Team Files` }],
  }),
  component: () => <FolderPage data={Route.useLoaderData()} />,
  notFoundComponent: () => <NotFoundPage what="Folder" />,
});
