import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "@/client/components/CopyButton";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Spinner } from "@/client/components/ui/spinner";
import { Switch } from "@/client/components/ui/switch";
import { today } from "@/client/lib/format";
import { deleteLink, getLink, saveLink } from "@/serverFunctions/sharing";
import { useRun } from "./useRun";

type Link = Awaited<ReturnType<typeof getLink>>;

export function LinkDialog({
  item,
  onClose,
}: {
  item: { id: string; name: string };
  onClose: () => void;
}) {
  const [link, setLink] = useState<Link | undefined>(undefined);
  const [allowDownload, setAllowDownload] = useState(false);
  const [expires, setExpires] = useState("");
  const { run, pending } = useRun();

  const load = useCallback(
    () =>
      getLink({ data: { itemId: item.id } }).then((l) => {
        setLink(l);
        setAllowDownload(l?.allowDownload ?? false);
        setExpires(l?.expires ?? "");
      }),
    [item.id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: { allowDownload: boolean; expires: string }) {
    await run(() =>
      saveLink({
        data: {
          itemId: item.id,
          allowDownload: next.allowDownload,
          expires: next.expires || null,
        },
      }),
    );
    await load();
  }

  const url = link ? `${window.location.origin}/s/${link.token}` : "";

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Public link</DialogTitle>
          <DialogDescription>
            Anyone with the link can view “{item.name}” without signing in.
          </DialogDescription>
        </DialogHeader>
        {link === undefined ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            {link ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={url}
                  data-testid="link-url"
                  aria-label="Link"
                />
                <CopyButton value={url} successMessage="Link copied." />
              </div>
            ) : null}
            {link?.expired ? <Badge variant="outline">Expired</Badge> : null}
            <div className="flex items-center gap-3">
              <Switch
                aria-label="Allow download"
                checked={allowDownload}
                onCheckedChange={(checked) => {
                  setAllowDownload(checked);
                  if (link) void save({ allowDownload: checked, expires });
                }}
              />
              <span className="text-sm">Allow download</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-expires">Expires (optional)</Label>
              <Input
                id="link-expires"
                type="date"
                min={today()}
                value={expires}
                onChange={(e) => {
                  setExpires(e.target.value);
                  if (link)
                    void save({ allowDownload, expires: e.target.value });
                }}
              />
            </div>
            <div className="flex justify-end">
              {link ? (
                <Button
                  variant="outline"
                  pending={pending}
                  onClick={async () => {
                    await run(() => deleteLink({ data: { itemId: item.id } }));
                    await load();
                  }}
                >
                  Turn off link
                </Button>
              ) : (
                <Button
                  pending={pending}
                  onClick={() => void save({ allowDownload, expires })}
                >
                  Turn on link
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
