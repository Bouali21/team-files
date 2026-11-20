import { useCallback, useEffect, useState } from "react";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { Spinner } from "@/client/components/ui/spinner";
import { Textarea } from "@/client/components/ui/textarea";
import { formatDate } from "@/client/lib/format";
import {
  addComment,
  deleteComment,
  editComment,
  getComments,
} from "@/serverFunctions/sharing";
import { useRun } from "./useRun";

type Data = Awaited<ReturnType<typeof getComments>>;

export function Comments({ itemId }: { itemId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(
    null,
  );
  const { run, pending } = useRun();
  const load = useCallback(
    () => getComments({ data: { itemId } }).then(setData),
    [itemId],
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
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">Comments</h2>
      {data === null ? (
        <Spinner />
      ) : (
        <>
          {data.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.comments.map((c) => (
                <li
                  key={c.id}
                  data-testid="comment"
                  className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{c.authorEmail}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(c.createdAt)}
                      {c.edited ? " · edited" : ""}
                    </span>
                  </div>
                  {editing?.id === c.id ? (
                    <div className="space-y-2">
                      <Textarea
                        aria-label="Edited text"
                        value={editing.body}
                        onChange={(e) =>
                          setEditing({ id: c.id, body: e.target.value })
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          pending={pending}
                          onClick={async () => {
                            if (
                              await change(() => editComment({ data: editing }))
                            )
                              setEditing(null);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  )}
                  {editing?.id !== c.id && (c.canEdit || c.canDelete) ? (
                    <div className="flex gap-1">
                      {c.canEdit ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setEditing({ id: c.id, body: c.body })}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {c.canDelete ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            void change(() =>
                              deleteComment({ data: { id: c.id } }),
                            )
                          }
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {data.canPost ? (
            <form
              className="space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!body.trim()) return;
                if (await change(() => addComment({ data: { itemId, body } })))
                  setBody("");
              }}
            >
              <Label htmlFor="comment-body">Comment</Label>
              <Textarea
                id="comment-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                pending={pending}
                disabled={!body.trim()}
              >
                Post
              </Button>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
