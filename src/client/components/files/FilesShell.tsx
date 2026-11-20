import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINKS = [
  { to: "/", label: "My files" },
  { to: "/shared", label: "Shared" },
  { to: "/recent", label: "Recent" },
  { to: "/starred", label: "Starred" },
  { to: "/trash", label: "Trash" },
  { to: "/search", label: "Search" },
] as const;

/** The app's frame: AppShell with the file sections in its bar. */
export function FilesShell({ children }: { children: ReactNode }) {
  const isAdmin = useRouterState({
    select: (s) => {
      const root = s.matches[0]?.loaderData;
      return !!(root && "isAdmin" in root && root.isAdmin);
    },
  });
  const links = isAdmin
    ? [...LINKS, { to: "/admin", label: "Admin" } as const]
    : LINKS;
  return (
    <AppShell
      nav={
        <nav
          aria-label="Sections"
          className="flex min-w-0 items-center gap-1 overflow-x-auto"
        >
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "bg-muted text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
