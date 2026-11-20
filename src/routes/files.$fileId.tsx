import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/client/components/PageHeader";
import { Comments } from "@/client/components/files/Comments";
import { FilePreview } from "@/client/components/files/FilePreview";
import { FilesShell } from "@/client/components/files/FilesShell";
import { Breadcrumb, NotFoundPage } from "@/client/components/files/FolderPage";
import {
  ItemDialog,
  type DialogKind,
} from "@/client/components/files/ItemActions";
import { useRun } from "@/client/components/files/useRun";
import { Button } from "@/client/components/ui/button";
import { formatBytes, formatDate } from "@/client/lib/format";
import { canEdit } from "@/server/roles";
import { getFile, setStar, trashItem } from "@/serverFunctions/files";

export const Route = createFileRoute("/files/$fileId")({
  loader: ({ params }) => getFile({ data: { id: params.fileId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.item.name ?? "File"} · Team Files` }],
  }),
  component: FileView,
  notFoundComponent: () => <NotFoundPage what="File" />,
});

function FileView() {
  const { item, path, inOwnSpace, text } = Route.useLoaderData();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const { run } = useRun();
  const navigate = useNavigate();
  const editable = canEdit(item.role);
  const raw = `/api/files/${item.id}/raw`;
  return (
    <FilesShell>
      <PageHeader
        title={item.name}
        backLink={<Breadcrumb path={path} inOwnSpace={inOwnSpace} />}
        description={`${item.ownedByMe ? "Yours" : item.ownerEmail} · ${formatBytes(item.size)} · Modified ${formatDate(item.updatedAt)}`}
        actions={
          <>
            <Button
              variant="outline"
              render={<a href={`${raw}?download=1`} download />}
            >
              <Download /> Download
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void run(() =>
                  setStar({ data: { id: item.id, on: !item.starred } }),
                )
              }
            >
              {item.starred ? "Remove star" : "Add star"}
            </Button>
            {editable ? (
              <>
                <Button variant="outline" onClick={() => setDialog("rename")}>
                  Rename
                </Button>
                <Button variant="outline" onClick={() => setDialog("move")}>
                  Move
                </Button>
                <Button variant="outline" onClick={() => setDialog("share")}>
                  Share
                </Button>
                <Button variant="outline" onClick={() => setDialog("link")}>
                  Public link
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (
                      await run(
                        () => trashItem({ data: { id: item.id } }),
                        `Moved “${item.name}” to the trash.`,
                      )
                    )
                      await navigate({ to: "/" });
                  }}
                >
                  Move to trash
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <FilePreview file={item} src={raw} text={text} />
        <Comments itemId={item.id} />
      </div>
      <ItemDialog item={item} kind={dialog} onClose={() => setDialog(null)} />
    </FilesShell>
  );
}
