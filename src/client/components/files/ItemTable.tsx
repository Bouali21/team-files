import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
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
import type { ListedItem } from "@/server/items";
import { RowActions } from "./ItemActions";
import { ItemIcon } from "./ItemIcon";

type SortKey = "name" | "owner" | "updatedAt" | "size";

export function ItemTable({
  items,
  actions,
  dateLabel = "Modified",
}: {
  items: ListedItem[];
  /** Replaces the row menu, as the trash does. */
  actions?: (item: ListedItem) => ReactNode;
  dateLabel?: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(
    null,
  );
  const sorted = useMemo(() => {
    const rows = [...items];
    if (!sort) {
      return rows.sort(
        (a, b) =>
          Number(b.kind === "folder") - Number(a.kind === "folder") ||
          a.name.localeCompare(b.name),
      );
    }
    const value = (i: ListedItem) =>
      sort.key === "owner" ? (i.ownedByMe ? "me" : i.ownerEmail) : i[sort.key];
    rows.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const c =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y));
      return sort.desc ? -c : c;
    });
    return rows;
  }, [items, sort]);

  const header = (key: SortKey, label: string, className?: string) => (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5"
        onClick={() =>
          setSort((s) =>
            s?.key === key ? { key, desc: !s.desc } : { key, desc: false },
          )
        }
      >
        {label}
        {sort?.key === key ? sort.desc ? <ArrowDown /> : <ArrowUp /> : null}
      </Button>
    </TableHead>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {header("name", "Name")}
            {header("owner", "Owner", "hidden md:table-cell")}
            {header("updatedAt", dateLabel, "hidden sm:table-cell")}
            {header("size", "Size", "hidden sm:table-cell")}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => (
            <TableRow key={item.id} data-testid="item-row">
              <TableCell className="max-w-0 w-full">
                <div className="flex min-w-0 items-center gap-2">
                  <ItemIcon group={item.group} />
                  {item.trashedAt ? (
                    <span data-testid="item-name" className="truncate">
                      {item.name}
                    </span>
                  ) : (
                    <Link
                      data-testid="item-name"
                      className="truncate font-medium hover:underline"
                      to={
                        item.kind === "folder"
                          ? "/folders/$folderId"
                          : "/files/$fileId"
                      }
                      params={
                        item.kind === "folder"
                          ? { folderId: item.id }
                          : { fileId: item.id }
                      }
                    >
                      {item.name}
                    </Link>
                  )}
                  {item.starred ? (
                    <Star
                      className="size-3.5 shrink-0 fill-current text-muted-foreground"
                      aria-label="Starred"
                    />
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                {item.ownedByMe ? "me" : item.ownerEmail}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                {formatDate(item.trashedAt ?? item.updatedAt)}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                {item.kind === "folder" ? "—" : formatBytes(item.size)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {actions ? actions(item) : <RowActions item={item} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
