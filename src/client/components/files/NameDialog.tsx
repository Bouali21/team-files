import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";

/** Asks for a name: a new folder's, or a new name for an item. */
export function NameDialog({
  title,
  initial = "",
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [pending, setPending] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            setPending(true);
            const ok = await onSubmit(name.trim());
            setPending(false);
            if (ok) onClose();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              autoFocus
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => {
                const dot = e.target.value.lastIndexOf(".");
                e.target.setSelectionRange(
                  0,
                  dot > 0 ? dot : e.target.value.length,
                );
              }}
            />
          </div>
          <DialogFooter>
            <Button type="submit" pending={pending} disabled={!name.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
