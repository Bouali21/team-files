import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { FilesShell } from "@/client/components/files/FilesShell";
import { ItemTable } from "@/client/components/files/ItemTable";
import { getStarred } from "@/serverFunctions/files";

export const Route = createFileRoute("/starred")({
  loader: () => getStarred(),
  head: () => ({ meta: [{ title: "Starred · Team Files" }] }),
  component: () => {
    const items = Route.useLoaderData();
    return (
      <FilesShell>
        <PageHeader title="Starred" />
        {items.length === 0 ? (
          <EmptyState
            title="No starred items"
            description="Star a file or folder from its menu to find it here."
          />
        ) : (
          <ItemTable items={items} />
        )}
      </FilesShell>
    );
  },
});
