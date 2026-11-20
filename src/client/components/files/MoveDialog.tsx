import { useEffect, useState } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Spinner } from "@/client/components/ui/spinner";
import { getMoveTargets, moveItem } from "@/serverFunctions/files";
import { useRun } from "./useRun";

const TOP = "__top__";

export function MoveDialog({
  item,
  onClose,
}: {
  item: { id: string; name: string; ownedByMe: boolean };
  onClose: () => void;
}) {
  const [targets, setTargets] = useState<
    { value: string; label: string }[] | null
  >(null);
  const [dest, setDest] = useState<string | null>(null);
  const { run, pending } = useRun();
  useEffect(() => {
    void getMoveTargets({ data: { id: item.id } }).then((list) =>
      setTargets([
        ...(item.ownedByMe ? [{ value: TOP, label: "My files" }] : []),
        ...list.map((t) => ({ value: t.id, label: t.label })),
      ]),
    );
  }, [item.id, item.ownedByMe]);
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move “{item.name}”</DialogTitle>
        </DialogHeader>
        {targets === null ? (
          <Spinner />
        ) : (
          <div className="space-y-2">
            <Label>Destination</Label>
            <Select
              items={targets}
              value={dest}
              onValueChange={(v) => setDest(v)}
            >
              <SelectTrigger data-testid="move-destination" className="w-full">
                <SelectValue placeholder="Choose a folder" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button
            disabled={!dest}
            pending={pending}
            onClick={async () => {
              const ok = await run(() =>
                moveItem({
                  data: { id: item.id, parentId: dest === TOP ? null : dest },
                }),
              );
              if (ok) onClose();
            }}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
