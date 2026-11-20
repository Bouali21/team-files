import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { FilesShell } from "@/client/components/files/FilesShell";
import { ItemTable } from "@/client/components/files/ItemTable";
import { getSharedWithMe } from "@/serverFunctions/files";

export const Route = createFileRoute("/shared")({
  loader: () => getSharedWithMe(),
  head: () => ({ meta: [{ title: "Shared with me · Team Files" }] }),
  component: () => {
    const items = Route.useLoaderData();
    return (
      <FilesShell>
        <PageHeader title="Shared with me" />
        {items.length === 0 ? (
          <EmptyState title="Nothing shared with you yet" />
        ) : (
          <ItemTable items={items} />
        )}
      </FilesShell>
    );
  },
});
