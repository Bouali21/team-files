import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { FilesShell } from "@/client/components/files/FilesShell";
import { useRun } from "@/client/components/files/useRun";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatBytes, formatDate } from "@/client/lib/format";
import { getAdmin, revokeAnyLink } from "@/serverFunctions/admin";

export const Route = createFileRoute("/admin")({
  loader: () => getAdmin(),
  head: () => ({ meta: [{ title: "Admin · Team Files" }] }),
  component: Admin,
});

const panel = "overflow-hidden rounded-xl border border-border bg-card";

function Admin() {
  const data = Route.useLoaderData();
  const { run } = useRun();
  if (!data.allowed)
    return (
      <FilesShell>
        <PageHeader
          title="Admin"
          description="Only admins can open this page."
        />
      </FilesShell>
    );
  return (
    <FilesShell>
      <PageHeader title="Admin" />
      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">
          Storage by member
        </h2>
        <div className={panel}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.storage.map((m) => (
                <TableRow key={m.email} data-testid="storage-row">
                  <TableCell>{m.email}</TableCell>
                  <TableCell className="text-right">{m.files}</TableCell>
                  <TableCell className="text-right">
                    {formatBytes(m.bytes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Public links</h2>
        {data.links.length === 0 ? (
          <EmptyState title="No public links" />
        ) : (
          <div className={panel}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Owner</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Expires
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Download
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.links.map((l) => (
                  <TableRow key={l.token} data-testid="link-row">
                    <TableCell>{l.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {l.ownerEmail}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {l.expiresAt ? formatDate(l.expiresAt) : "Never"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {l.allowDownload ? "Allowed" : "Off"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void run(() =>
                            revokeAnyLink({ data: { token: l.token } }),
                          )
                        }
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </FilesShell>
  );
}
