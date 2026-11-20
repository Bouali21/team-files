import { Link, useRouter } from "@tanstack/react-router";
import { FolderPlus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { formatBytes } from "@/client/lib/format";
import { canEdit } from "@/server/roles";
import { createFolder } from "@/serverFunctions/files";
import type { getFolder } from "@/serverFunctions/files";
import { FilesShell } from "./FilesShell";
import { ItemDialog, type DialogKind } from "./ItemActions";
import { ItemTable } from "./ItemTable";
import { NameDialog } from "./NameDialog";
import { useRun } from "./useRun";

type Folder = Awaited<ReturnType<typeof getFolder>>;

export function Breadcrumb({
  path,
  inOwnSpace,
}: {
  path: { id: string; name: string }[];
  inOwnSpace: boolean;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
    >
      <Link to={inOwnSpace ? "/" : "/shared"} className="hover:text-foreground">
        {inOwnSpace ? "My files" : "Shared with me"}
      </Link>
      {path.map((p) => (
        <span key={p.id} className="flex items-center gap-1">
          <span aria-hidden>/</span>
          <Link
            to="/folders/$folderId"
            params={{ folderId: p.id }}
            className="hover:text-foreground"
          >
            {p.name}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function FolderPage({ data }: { data: Folder }) {
  const router = useRouter();
  const { run } = useRun();
  const input = useRef<HTMLInputElement>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const editable = canEdit(data.role);
  const parentId = data.folder?.id ?? null;

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;
    const form = new FormData();
    if (parentId) form.set("parentId", parentId);
    for (const f of list) form.append("file", f);
    setUploading(true);
    try {
      const res = await fetch("/api/files", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      toast.success(
        list.length === 1
          ? `Uploaded “${list[0]!.name}”.`
          : `Uploaded ${list.length} files.`,
      );
      await router.invalidate();
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  const folderItem = data.folder
    ? {
        id: data.folder.id,
        name: data.folder.name,
        kind: "folder" as const,
        role: data.role,
        starred: false,
        ownedByMe: data.role === "owner",
      }
    : null;

  return (
    <FilesShell>
      <PageHeader
        title={data.folder?.name ?? "My files"}
        backLink={
          data.folder ? (
            <Breadcrumb
              path={data.path.slice(0, -1)}
              inOwnSpace={data.inOwnSpace}
            />
          ) : undefined
        }
        description={
          data.storage !== null ? (
            <span data-testid="storage-used">
              {formatBytes(data.storage)} used
            </span>
          ) : undefined
        }
        actions={
          editable ? (
            <>
              {folderItem ? (
                <>
                  <Button variant="outline" onClick={() => setDialog("share")}>
                    Share
                  </Button>
                  <Button variant="outline" onClick={() => setDialog("link")}>
                    Public link
                  </Button>
                </>
              ) : null}
              <Button variant="outline" onClick={() => setNewFolder(true)}>
                <FolderPlus /> New folder
              </Button>
              <Button
                pending={uploading}
                onClick={() => input.current?.click()}
              >
                <Upload /> Upload
              </Button>
              <input
                ref={input}
                type="file"
                multiple
                hidden
                data-testid="upload-input"
                onChange={(e) => e.target.files && void upload(e.target.files)}
              />
            </>
          ) : null
        }
      />
      <div
        onDragOver={(e) => editable && e.preventDefault()}
        onDrop={(e) => {
          if (!editable) return;
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
      >
        {data.items.length === 0 ? (
          <EmptyState
            title={data.folder ? "This folder is empty" : "No files yet"}
            description={
              editable ? "Upload files or drop them here." : undefined
            }
          />
        ) : (
          <ItemTable items={data.items} />
        )}
      </div>
      {newFolder ? (
        <NameDialog
          title="New folder"
          submitLabel="Create"
          onClose={() => setNewFolder(false)}
          onSubmit={(name) =>
            run(() => createFolder({ data: { name, parentId } }))
          }
        />
      ) : null}
      {folderItem ? (
        <ItemDialog
          item={folderItem}
          kind={dialog}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </FilesShell>
  );
}

export function NotFoundPage({ what }: { what: string }) {
  return (
    <FilesShell>
      <PageHeader
        title={`${what} not found`}
        description="It may be in the trash, or no longer shared with you."
        actions={
          <Button variant="outline" render={<Link to="/" />}>
            My files
          </Button>
        }
      />
    </FilesShell>
  );
}
