import type { AttachmentRow } from "@/features/attachments/queries";
import type { FieldDefinition } from "@/features/types/schemas";
import type { JSONContent } from "@tiptap/core";
import { CommentForm } from "./comment-form";
import { ChecklistInteractivity } from "./checklist-interactivity";
import { buildPublicProperties } from "../lib/build-public-item";
import { renderPublicContentHtml } from "../lib/render-public-content";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Corpo da página pública `/p/[token]` (3.11): título, propriedades
 * visíveis, conteúdo renderizado (com checklist interativa se `check`),
 * anexos por URL assinada e formulário de comentário se `comment`.
 */
export function SharePageContent({
  token,
  permission,
  title,
  content,
  fields,
  properties,
  attachments,
}: {
  token: string;
  permission: string;
  title: string;
  content: JSONContent | null;
  fields: FieldDefinition[];
  properties: Record<string, unknown>;
  attachments: AttachmentRow[];
}) {
  const publicProperties = buildPublicProperties(properties, fields);
  const interactiveChecklist = permission === "check";
  const html = renderPublicContentHtml(content, { interactiveChecklist });

  const contentBlock = (
    <div className="share-content prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{title}</h1>

      {publicProperties.length > 0 && (
        <dl className="flex flex-col gap-1 text-sm">
          {publicProperties.map((prop) => (
            <div key={prop.key} className="flex gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">{prop.label}:</dt>
              <dd className="text-black dark:text-zinc-50">{prop.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {interactiveChecklist ? <ChecklistInteractivity token={token}>{contentBlock}</ChecklistInteractivity> : contentBlock}

      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-black dark:text-zinc-50">Anexos</h2>
          <ul className="flex flex-col gap-1">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                <a
                  href={`/p/${token}/attachments/${attachment.id}`}
                  className="text-sm text-blue-600 underline dark:text-blue-400"
                >
                  {attachment.fileName}
                </a>
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">{formatSize(attachment.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {permission === "comment" && <CommentForm token={token} />}
    </div>
  );
}
