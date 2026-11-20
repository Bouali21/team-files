import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Spinner } from "@/client/components/ui/spinner";
import { today } from "@/client/lib/format";
import type { ShareRole } from "@/server/roles";
import {
  addShare,
  getShares,
  removeShare,
  transferOwnership,
  updateShare,
} from "@/serverFunctions/sharing";
import { useRun } from "./useRun";

const ROLES: { value: ShareRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "commenter", label: "Commenter" },
  { value: "editor", label: "Editor" },
];

type Shares = Awaited<ReturnType<typeof getShares>>;

function RoleSelect({
  value,
  onChange,
  testId,
  label,
}: {
  value: ShareRole;
  onChange: (role: ShareRole) => void;
  testId: string;
  label: string;
}) {
  return (
    <Select items={ROLES} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger data-testid={testId} aria-label={label} className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ShareDialog({
  item,
  onClose,
}: {
  item: { id: string; name: string };
  onClose: () => void;
}) {
  const [data, setData] = useState<Shares | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [expires, setExpires] = useState("");
  const [transfer, setTransfer] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const { run, pending } = useRun();

  const load = useCallback(
    () => getShares({ data: { itemId: item.id } }).then(setData),
    [item.id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const change = async (work: () => Promise<unknown>) => {
    const ok = await run(work);
    await load();
    return ok;
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending && !transfer && onClose()}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Share “{item.name}”</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await change(() =>
              addShare({
                data: {
                  itemId: item.id,
                  email,
                  role,
                  expires: expires || null,
                },
              }),
            );
            if (ok) {
              setEmail("");
              setExpires("");
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="share-email">Email</Label>
            <Input
              id="share-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <RoleSelect
              value={role}
              onChange={setRole}
              testId="share-role"
              label="Role"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="share-expires">Expires (optional)</Label>
            <Input
              id="share-expires"
              type="date"
              min={today()}
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" pending={pending} className="w-full">
              Add
            </Button>
          </div>
        </form>

        {data === null ? (
          <Spinner />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{data.ownerEmail}</span>
              <span className="text-muted-foreground">Owner</span>
            </li>
            {data.shares.map((s) => (
              <li
                key={s.id}
                data-testid="share-row"
                className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{s.email}</span>
                {s.expired ? <Badge variant="outline">Expired</Badge> : null}
                <Input
                  type="date"
                  aria-label={`Expiry for ${s.email}`}
                  className="w-36"
                  min={today()}
                  value={s.expires ?? ""}
                  onChange={(e) =>
                    void change(() =>
                      updateShare({
                        data: {
                          shareId: s.id,
                          expires: e.target.value || null,
                        },
                      }),
                    )
                  }
                />
                <RoleSelect
                  value={s.role}
                  testId="share-row-role"
                  label={`Role for ${s.email}`}
                  onChange={(next) =>
                    void change(() =>
                      updateShare({ data: { shareId: s.id, role: next } }),
                    )
                  }
                />
                {data.isOwner && s.canBecomeOwner ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTransfer({ id: s.id, email: s.email })}
                  >
                    Make owner
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${s.email}`}
                  onClick={() =>
                    void change(() => removeShare({ data: { shareId: s.id } }))
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {transfer ? (
          <ConfirmDialog
            title={`Make ${transfer.email} the owner?`}
            confirmLabel="Transfer"
            pending={pending}
            onClose={() => setTransfer(null)}
            onConfirm={async () => {
              await change(() =>
                transferOwnership({ data: { shareId: transfer.id } }),
              );
              setTransfer(null);
            }}
          >
            You'll keep edit access, but only they can delete it or change its
            owner.
          </ConfirmDialog>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
