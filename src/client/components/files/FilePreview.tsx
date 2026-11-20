import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { formatBytes } from "@/client/lib/format";
import { previewKind } from "@/server/roles";

/** The file shown in the page; types the browser can't show get their details. */
export function FilePreview({
  file,
  src,
  text,
}: {
  file: { name: string; mimeType: string | null; size: number };
  src: string;
  text: string | null;
}) {
  const kind = previewKind(file.mimeType, file.name);
  return (
    <div
      data-testid="preview"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      {kind === "image" ? (
        <img
          src={src}
          alt={file.name}
          className="mx-auto max-h-[70vh] object-contain"
        />
      ) : kind === "pdf" ? (
        <iframe src={src} title={file.name} className="h-[75vh] w-full" />
      ) : kind === "video" ? (
        <video src={src} controls className="max-h-[70vh] w-full" />
      ) : kind === "audio" ? (
        <div className="p-6">
          <audio src={src} controls className="w-full" />
        </div>
      ) : kind === "text" ? (
        <pre className="max-h-[70vh] overflow-auto p-4 font-mono text-sm whitespace-pre-wrap">
          {text}
        </pre>
      ) : (
        <EmptyState
          variant="plain"
          icon={FileQuestion}
          title="No preview for this type"
          description={`${file.mimeType || "Unknown type"} · ${formatBytes(file.size)}`}
        />
      )}
    </div>
  );
}
