import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { FilesShell } from "@/client/components/files/FilesShell";
import { ItemTable } from "@/client/components/files/ItemTable";
import { getRecent } from "@/serverFunctions/files";

export const Route = createFileRoute("/recent")({
  loader: () => getRecent(),
  head: () => ({ meta: [{ title: "Recent · Team Files" }] }),
  component: () => {
    const items = Route.useLoaderData();
    return (
      <FilesShell>
        <PageHeader title="Recent" />
        {items.length === 0 ? (
          <EmptyState title="Nothing here yet" />
        ) : (
          <ItemTable key="recent" items={[...items]} />
        )}
      </FilesShell>
    );
  },
});
