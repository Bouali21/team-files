import { File, FileText, Film, Folder, Image, Music } from "lucide-react";
import type { TypeGroup } from "@/server/roles";

const ICONS = {
  folder: Folder,
  document: FileText,
  image: Image,
  pdf: FileText,
  video: Film,
  audio: Music,
  other: File,
} as const;

export function ItemIcon({ group }: { group: TypeGroup }) {
  const Icon = ICONS[group];
  return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}
