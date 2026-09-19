"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelJob, getJobDetail, getJobsPage, retryJob } from "../actions";
import type { JobDetail, JobRow } from "../queries";

const STATUS_OPTIONS = [
  { value: "", label: "Qualquer status" },
  { value: "queued", label: "Na fila" },
  { value: "running", label: "Rodando" },
  { value: "done", label: "Concluído" },
  { value: "failed", label: "Falhou" },
  { value: "canceled", label: "Cancelado" },
];

const STATUS_LABELS: Record<string, string> = {
  queued: "Na fila",
  running: "Rodando",
  done: "Concluído",
  failed: "Falhou",
  canceled: "Cancelado",
};

const PAGE_SIZE = 30;

const selectClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

export function JobsWorkspace({
  initialRows,
  initialTotal,
  kinds,
}: {
  initialRows: JobRow[];
  initialTotal: number;
  kinds: string[];
}) {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await getJobsPage({ status: status || null, kind: kind || null }, page);
      setRows(data.rows);
      setTotal(data.total);
    });
  }, [status, kind, page]);

  function handleFilterChange(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(0);
    };
  }

  function handleRetry(jobId: string) {
    startTransition(async () => {
      const result = await retryJob(jobId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Job voltou pra fila");
      setRows((current) => current.map((r) => (r.id === jobId ? { ...r, status: "queued", attempts: 0, lastError: null } : r)));
    });
  }

  function handleCancel(jobId: string) {
    startTransition(async () => {
      const result = await cancelJob(jobId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Job cancelado");
      setRows((current) => current.map((r) => (r.id === jobId ? { ...r, status: "canceled" } : r)));
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => handleFilterChange(setStatus)(e.target.value)}
          className={selectClassName}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select aria-label="Tipo" value={kind} onChange={(e) => handleFilterChange(setKind)(e.target.value)} className={selectClassName}>
          <option value="">Qualquer tipo</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {pending && <span className="text-xs text-zinc-400 dark:text-zinc-500">Carregando...</span>}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum job encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((job) => (
            <JobRowItem
              key={job.id}
              job={job}
              open={openJobId === job.id}
              onToggle={() => setOpenJobId((current) => (current === job.id ? null : job.id))}
              onRetry={() => handleRetry(job.id)}
              onCancel={() => handleCancel(job.id)}
            />
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}

function JobRowItem({
  job,
  open,
  onToggle,
  onRetry,
  onCancel,
}: {
  job: JobRow;
  open: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const [detail, setDetail] = useState<JobDetail | null>(null);

  useEffect(() => {
    if (!open) return;
    getJobDetail(job.id).then(setDetail);
  }, [open, job.id]);

  const canRetry = job.status === "failed" || job.status === "canceled";
  const canCancel = job.status === "queued" || job.status === "running";

  return (
    <li className="rounded-lg border border-black/[.08] dark:border-white/[.08]">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm">
        <span className="min-w-0 flex-1 truncate font-medium text-black dark:text-zinc-50">{job.kind}</span>
        <StatusBadge status={job.status} />
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
          {job.attempts}/{job.maxAttempts} tentativas
        </span>
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">{new Date(job.createdAt).toLocaleString("pt-BR")}</span>
      </button>

      {job.lastError && !open && (
        <p className="truncate px-3 pb-2 text-xs text-red-600 dark:text-red-400">{job.lastError}</p>
      )}

      {open && (
        <div className="flex flex-col gap-2 border-t border-black/[.08] px-3 py-2.5 text-xs dark:border-white/[.08]">
          {!detail ? (
            <p className="text-zinc-400 dark:text-zinc-500">Carregando...</p>
          ) : (
            <>
              <div>
                <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">Payload</p>
                <pre className="overflow-x-auto rounded-md bg-black/[.03] p-2 dark:bg-white/[.06]">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </div>
              {detail.result != null && (
                <div>
                  <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">Resultado</p>
                  <pre className="overflow-x-auto rounded-md bg-black/[.03] p-2 dark:bg-white/[.06]">
                    {JSON.stringify(detail.result, null, 2)}
                  </pre>
                </div>
              )}
              {detail.lastError && (
                <div>
                  <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">Erro</p>
                  <p className="text-red-600 dark:text-red-400">{detail.lastError}</p>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2 pt-1">
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full border border-black/[.12] px-3 py-1 text-zinc-600 hover:bg-black/[.04] dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
              >
                Tentar de novo
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    canceled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${colors[status] ?? colors.queued}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
