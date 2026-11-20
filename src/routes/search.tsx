import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { FilesShell } from "@/client/components/files/FilesShell";
import { ItemTable } from "@/client/components/files/ItemTable";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { TYPE_GROUPS, type TypeGroup } from "@/server/roles";
import { searchItems } from "@/serverFunctions/files";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  type: z
    .enum(TYPE_GROUPS as [TypeGroup, ...TypeGroup[]])
    .optional()
    .catch(undefined),
});

const TYPE_LABELS: Record<TypeGroup, string> = {
  folder: "Folders",
  document: "Documents",
  image: "Images",
  pdf: "PDFs",
  video: "Videos",
  audio: "Audio",
  other: "Other",
};
const ALL = "all";
const TYPE_ITEMS = [
  { value: ALL, label: "Any type" },
  ...TYPE_GROUPS.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
];

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    deps.q || deps.type
      ? searchItems({ data: { q: deps.q, type: deps.type } })
      : null,
  head: () => ({ meta: [{ title: "Search · Team Files" }] }),
  component: Search,
});

function Search() {
  const results = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [q, setQ] = useState(search.q ?? "");
  return (
    <FilesShell>
      <PageHeader title="Search" />
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({
            search: { q: q.trim() || undefined, type: search.type },
          });
        }}
      >
        <Input
          data-testid="search-input"
          aria-label="Search by name"
          placeholder="Search by name"
          className="min-w-48 flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          items={TYPE_ITEMS}
          value={search.type ?? ALL}
          onValueChange={(v) =>
            void navigate({
              search: {
                q: search.q,
                type: v && v !== ALL ? (v as TypeGroup) : undefined,
              },
            })
          }
        >
          <SelectTrigger
            data-testid="type-filter"
            aria-label="Type"
            className="w-36"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_ITEMS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit">Search</Button>
      </form>
      {results === null ? null : results.length === 0 ? (
        <EmptyState kind="filtered" title="No matches" />
      ) : (
        <ItemTable items={results} />
      )}
    </FilesShell>
  );
}
