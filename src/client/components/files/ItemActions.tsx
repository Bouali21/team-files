import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { canEdit, type Role } from "@/server/roles";
import { renameItem, setStar, trashItem } from "@/serverFunctions/files";
import { LinkDialog } from "./LinkDialog";
import { MoveDialog } from "./MoveDialog";
import { NameDialog } from "./NameDialog";
import { ShareDialog } from "./ShareDialog";
import { useRun } from "./useRun";

interface ActionItem {
  id: string;
  name: string;
  kind: "file" | "folder";
  role: Role;
  starred: boolean;
  ownedByMe: boolean;
}

export type DialogKind = "rename" | "move" | "share" | "link";

/** The dialog an action opened, if any. */
export function ItemDialog({
  item,
  kind,
  onClose,
}: {
  item: ActionItem;
  kind: DialogKind | null;
  onClose: () => void;
}) {
  const { run } = useRun();
  if (kind === "rename")
    return (
      <NameDialog
        title="Rename"
        initial={item.name}
        submitLabel="Save"
        onClose={onClose}
        onSubmit={(name) =>
          run(() => renameItem({ data: { id: item.id, name } }))
        }
      />
    );
  if (kind === "move") return <MoveDialog item={item} onClose={onClose} />;
  if (kind === "share") return <ShareDialog item={item} onClose={onClose} />;
  if (kind === "link") return <LinkDialog item={item} onClose={onClose} />;
  return null;
}

export function RowActions({ item }: { item: ActionItem }) {
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const { run } = useRun();
  const editable = canEdit(item.role);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More actions for ${item.name}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.kind === "file" ? (
            <DropdownMenuItem
              render={
                <a href={`/api/files/${item.id}/raw?download=1`} download />
              }
            >
              Download
            </DropdownMenuItem>
          ) : null}
          {editable ? (
            <>
              <DropdownMenuItem onClick={() => setDialog("rename")}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("move")}>
                Move
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("share")}>
                Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDialog("link")}>
                Public link
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem
            onClick={() =>
              void run(() =>
                setStar({ data: { id: item.id, on: !item.starred } }),
              )
            }
          >
            {item.starred ? "Remove star" : "Add star"}
          </DropdownMenuItem>
          {editable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  void run(
                    () => trashItem({ data: { id: item.id } }),
                    `Moved “${item.name}” to the trash.`,
                  )
                }
              >
                Move to trash
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ItemDialog item={item} kind={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
