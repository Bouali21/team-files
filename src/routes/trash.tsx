import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { FilesShell } from "@/client/components/files/FilesShell";
import { ItemTable } from "@/client/components/files/ItemTable";
import { useRun } from "@/client/components/files/useRun";
import { Button } from "@/client/components/ui/button";
import { deleteForever, getTrash, restoreItem } from "@/serverFunctions/files";

export const Route = createFileRoute("/trash")({
  loader: () => getTrash(),
  head: () => ({ meta: [{ title: "Trash · Team Files" }] }),
  component: Trash,
});

function Trash() {
  const items = Route.useLoaderData();
  const { run, pending } = useRun();
  const [doomed, setDoomed] = useState<{ id: string; name: string } | null>(
    null,
  );
  return (
    <FilesShell>
      <PageHeader
        title="Trash"
        description="Items are deleted forever after 30 days in the trash."
      />
      {items.length === 0 ? (
        <EmptyState title="Trash is empty" />
      ) : (
        <ItemTable
          items={items}
          dateLabel="Removed"
          actions={(item) => (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void run(() => restoreItem({ data: { id: item.id } }))
                }
              >
                Restore
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDoomed(item)}>
                Delete forever
              </Button>
            </div>
          )}
        />
      )}
      {doomed ? (
        <ConfirmDialog
          title={`Delete “${doomed.name}” forever?`}
          confirmLabel="Delete forever"
          destructive
          pending={pending}
          onClose={() => setDoomed(null)}
          onConfirm={async () => {
            await run(() => deleteForever({ data: { id: doomed.id } }));
            setDoomed(null);
          }}
        >
          {"It can't be recovered, and anyone it was shared with loses access."}
        </ConfirmDialog>
      ) : null}
    </FilesShell>
  );
}
