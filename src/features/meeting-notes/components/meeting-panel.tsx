"use client";

import { Copy, Mail, MessageCircle, Send, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { createShareLink } from "@/features/sharing/actions";
import type { SidebarSpace } from "@/features/spaces/queries";
import { MeetingTasksButton, meetingButtonClassName } from "@/features/transcripts/components/meeting-tasks-dialog";
import { mailtoAll, meetingShareMessage, whatsappLink, type MeetingParticipant } from "../lib/next-steps";

const chipClassName =
  "flex items-center gap-1.5 rounded-full border border-black/[.12] px-3 py-1.5 text-sm text-zinc-700 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-200 dark:hover:bg-white/[.06]";

/**
 * Painel da reunião (9.3) na página do item do tipo Reunião: gravar/transcrever,
 * transformar os "Próximos passos" da nota em tarefas (com responsável, prazo
 * e lembrete) e mandar o link da reunião pros participantes — por WhatsApp,
 * um por um, ou num e-mail só pra todos.
 */
export function MeetingPanel({
  itemId,
  title,
  dateLabel,
  participants,
  nextSteps,
  spaces,
  defaultSpaceId,
  recorder,
}: {
  itemId: string;
  title: string;
  dateLabel: string | null;
  participants: MeetingParticipant[];
  nextSteps: string[];
  spaces: SidebarSpace[];
  defaultSpaceId: string | null;
  /** Botão de gravar (componente da mídia), encaixado no topo do painel. */
  recorder?: ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const message = url ? meetingShareMessage(title, dateLabel, url) : "";
  const mailto = url ? mailtoAll(participants, `Reunião: ${title || "Reunião"}`, message) : null;

  function handleShare() {
    startTransition(async () => {
      const result = await createShareLink({ resourceId: itemId, permission: "view", validity: "90d" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(result.data.url);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby={`reuniao-${itemId}`} className="flex flex-col gap-4 rounded-2xl border border-black/[.06] bg-surface p-5 shadow-sm dark:border-white/[.06]">
      <h2 id={`reuniao-${itemId}`} className="flex items-center gap-2 font-semibold text-black dark:text-zinc-50">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-text">
          <Users className="h-4 w-4" aria-hidden />
        </span>
        Reunião
      </h2>

      {recorder}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Próximos passos</p>
        {nextSteps.length > 0 ? (
          <MeetingTasksButton
            itemId={itemId}
            label={`Criar ${nextSteps.length} ${nextSteps.length === 1 ? "tarefa" : "tarefas"} dos próximos passos`}
            suggestions={nextSteps.map((descricao) => ({ descricao, responsavel: null, prazo: null }))}
            spaces={spaces}
            defaultSpaceId={defaultSpaceId}
          />
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Escreva os próximos passos como checklist na seção &ldquo;Próximos passos&rdquo; da nota — eles viram tarefas com responsável, prazo e lembrete.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Enviar aos participantes</p>
        {!url ? (
          <button type="button" onClick={handleShare} disabled={pending} className={`${meetingButtonClassName} self-start`}>
            <Send className="h-4 w-4" aria-hidden /> {pending ? "Criando link…" : "Gerar link da reunião"}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Quem receber vê a nota sempre atualizada, sem precisar de conta. O link vale 90 dias.</p>
            <div className="flex flex-wrap gap-2">
              {participants.map((participant, index) => (
                <a key={`${participant.name}-${index}`} href={whatsappLink(participant.phoneE164, message)} target="_blank" rel="noopener noreferrer" className={chipClassName}>
                  <MessageCircle className="h-4 w-4" aria-hidden /> {participant.name}
                </a>
              ))}
              {participants.length === 0 && (
                <a href={whatsappLink(null, message)} target="_blank" rel="noopener noreferrer" className={chipClassName}>
                  <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
                </a>
              )}
              {mailto && (
                <a href={mailto} className={chipClassName}>
                  <Mail className="h-4 w-4" aria-hidden /> E-mail pra todos
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(message);
                  toast.success("Mensagem com o link copiada.");
                }}
                className={chipClassName}
              >
                <Copy className="h-4 w-4" aria-hidden /> Copiar
              </button>
            </div>
          </div>
        )}
        {participants.length === 0 && !url && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Adicione os participantes no campo &ldquo;Participantes&rdquo; pra mandar pra cada um direto.</p>
        )}
      </div>
    </section>
  );
}
