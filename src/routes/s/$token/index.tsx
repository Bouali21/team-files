import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/client/components/PageHeader";
import { FilePreview } from "@/client/components/files/FilePreview";
import { ItemIcon } from "@/client/components/files/ItemIcon";
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
import { typeGroup } from "@/server/roles";
import { getPublicView } from "@/serverFunctions/public";

// Public: what a view link shows. Links are plain anchors so every step is a
// full page load, which needs no member.
export const Route = createFileRoute("/s/$token/")({
  validateSearch: z.object({ item: z.string().optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ item: search.item }),
  loader: ({ params, deps }) =>
    getPublicView({ data: { token: params.token, id: deps.item ?? null } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.item.name ?? "Not found" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicView,
  notFoundComponent: () => (
    <Frame>
      <PageHeader
        title="Link not found"
        description="It may have expired or been turned off."
      />
    </Frame>
  ),
});

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 pt-8 pb-24 md:px-10">
      {children}
    </main>
  );
}

function PublicView() {
  const view = Route.useLoaderData();
  const { token } = Route.useParams();
  const at = (id: string) =>
    `/s/${token}${id === view.path[0]?.id ? "" : `?item=${encodeURIComponent(id)}`}`;
  const raw = `/s/${token}/raw/${view.item.id}`;
  return (
    <Frame>
      <PageHeader
        title={view.item.name}
        backLink={
          view.path.length > 1 ? (
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap gap-1 text-sm text-muted-foreground"
            >
              {view.path.slice(0, -1).map((p, i) => (
                <span key={p.id} className="flex gap-1">
                  {i > 0 ? <span aria-hidden>/</span> : null}
                  <a href={at(p.id)} className="hover:text-foreground">
                    {p.name}
                  </a>
                </span>
              ))}
            </nav>
          ) : undefined
        }
        description={
          view.item.kind === "file"
            ? `${formatBytes(view.item.size)} · Modified ${formatDate(view.item.updatedAt)}`
            : undefined
        }
        actions={
          view.item.kind === "file" && view.allowDownload ? (
            <Button
              variant="outline"
              render={<a href={`${raw}?download=1`} download />}
            >
              <Download /> Download
            </Button>
          ) : null
        }
      />
      {view.item.kind === "file" ? (
        <FilePreview file={view.item} src={raw} text={view.text} />
      ) : view.children.length === 0 ? (
        <p className="text-sm text-muted-foreground">This folder is empty.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Modified</TableHead>
                <TableHead className="hidden sm:table-cell">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.children.map((c) => (
                <TableRow key={c.id} data-testid="public-row">
                  <TableCell>
                    <a
                      href={at(c.id)}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <ItemIcon group={typeGroup(c.kind, null, c.name)} />
                      {c.name}
                    </a>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDate(c.updatedAt)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {c.kind === "folder" ? "—" : formatBytes(c.size)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Frame>
  );
}
