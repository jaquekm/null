import type { ShareCommentRow } from "../queries";

/** Comentários recebidos por links de compartilhamento `comment` deste item (3.11). */
export function ItemShareComments({ comments }: { comments: ShareCommentRow[] }) {
  if (comments.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">Comentários do link compartilhado</h2>
      <ul className="flex flex-col gap-3">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded-lg border border-black/[.08] p-3 text-sm dark:border-white/[.12]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-black dark:text-zinc-50">{comment.authorName}</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(comment.createdAt).toLocaleString("pt-BR")}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{comment.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
