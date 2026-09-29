"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import type { MeetingSummary } from "@/features/media/schemas";
import type { SidebarSpace } from "@/features/spaces/queries";
import { regenerateSummary } from "../actions";
import { MeetingTasksButton, meetingButtonClassName } from "./meeting-tasks-dialog";

/** "Gerar resumo novamente" e "Criar tarefas das ações" (2.7) — mostrado na página do item quando há transcrição com resumo. */
export function MeetingSummaryActions({
  itemId,
  transcriptId,
  acoes,
  spaces,
  defaultSpaceId,
}: {
  itemId: string;
  transcriptId: string;
  acoes: MeetingSummary["acoes"];
  spaces: SidebarSpace[];
  defaultSpaceId: string | null;
}) {
  const [regenerating, startRegenerating] = useTransition();

  function handleRegenerate() {
    startRegenerating(async () => {
      const result = await regenerateSummary(transcriptId, itemId);
      if (!result.ok) toast.error(result.error);
      else toast.success("Gerando um novo resumo — a página atualiza em instantes.");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={regenerating} onClick={handleRegenerate} className={meetingButtonClassName}>
        <RefreshCw className="h-4 w-4" />
        Gerar resumo novamente
      </button>

      {acoes.length > 0 && (
        <MeetingTasksButton
          itemId={itemId}
          label="Criar tarefas das ações"
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
          suggestions={acoes.map((acao) => ({ descricao: acao.descricao, responsavel: acao.responsavel, prazo: acao.prazo }))}
          spaces={spaces}
          defaultSpaceId={defaultSpaceId}
        />
      )}
    </div>
  );
}
