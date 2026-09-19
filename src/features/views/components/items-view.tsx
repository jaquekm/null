"use client";

import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { FieldDefinition } from "@/features/types/schemas";
import { getViewItems, updateViewConfig } from "../actions";
import type { ViewItemRow, ViewRow } from "../queries";
import { DEFAULT_PAGE_SIZE, type ViewConfig, type ViewFilter, type ViewSort } from "../schemas";
import { FilterBar } from "./filter-bar";
import { KanbanView } from "./kanban-view";
import { ListView } from "./list-view";
import { TableView } from "./table-view";

const selectClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

/**
 * Renderiza uma visão salva (1.15) — assinatura exatamente como o enunciado
 * pede: `{ spaceId?, typeId?, view }`. Busca seus próprios dados (campos do
 * tipo + itens filtrados/ordenados/paginados) via `getViewItems` toda vez
 * que filtro/ordenação/página muda; troca de visão (lista de visões salvas,
 * criar/renomear/duplicar/excluir/marcar padrão) é responsabilidade de quem
 * usa este componente (`ViewSwitcher`, na página do espaço).
 */
export function ItemsView({ spaceId, typeId, view }: { spaceId?: string; typeId?: string; view: ViewRow }) {
  const [filters, setFilters] = useState<ViewFilter[]>(view.config.filters);
  const [sort, setSort] = useState<ViewSort[]>(view.config.sort);
  const [groupBy, setGroupBy] = useState<string | undefined>(view.config.groupBy);
  const [visibleFields, setVisibleFields] = useState<string[] | undefined>(view.config.visibleFields);
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [rows, setRows] = useState<ViewItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, startLoading] = useTransition();
  const [savePending, startSave] = useTransition();

  const pageSize = view.kind === "kanban" ? 500 : (view.config.pageSize ?? DEFAULT_PAGE_SIZE);

  useEffect(() => {
    startLoading(async () => {
      const result = await getViewItems({ spaceId, typeId, filters, sort, page, pageSize });
      setFields(result.fields);
      setRows(result.rows);
      setTotal(result.total);
    });
  }, [spaceId, typeId, filters, sort, page, pageSize]);

  function updateFilters(next: ViewFilter[]) {
    setFilters(next);
    setPage(1);
    setDirty(true);
  }

  function updateSort(next: ViewSort[]) {
    setSort(next);
    setDirty(true);
  }

  function updateVisibleFields(next: string[]) {
    setVisibleFields(next);
    setDirty(true);
  }

  function updateGroupBy(next: string) {
    setGroupBy(next || undefined);
    setDirty(true);
  }

  function handleItemSaved(itemId: string, updatedAt: string) {
    setRows((current) => current.map((row) => (row.id === itemId ? { ...row, updatedAt } : row)));
  }

  function handleSaveConfig() {
    startSave(async () => {
      const config: ViewConfig = { filters, sort, groupBy, visibleFields, pageSize: view.config.pageSize };
      const result = await updateViewConfig(view.id, config);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success("Visão salva");
    });
  }

  const selectFields = fields.filter((field) => field.type === "select");
  const groupField = fields.find((field) => field.key === groupBy);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <FilterBar filters={filters} fields={fields} onChange={updateFilters} />
        {dirty && (
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={savePending}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-black/[.12] px-3 py-1.5 text-xs text-zinc-600 hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            <Save className="h-3.5 w-3.5" />
            {savePending ? "Salvando..." : "Salvar visão"}
          </button>
        )}
      </div>

      {view.kind === "kanban" && (
        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          Agrupar por
          <select value={groupBy ?? ""} onChange={(e) => updateGroupBy(e.target.value)} className={selectClassName}>
            <option value="">Escolher campo...</option>
            {selectFields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {loading && rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Carregando...</p>
      ) : view.kind === "list" ? (
        <ListView rows={rows} fields={fields} visibleFields={visibleFields} />
      ) : view.kind === "table" ? (
        <TableView
          rows={rows}
          fields={fields}
          sort={sort}
          onSortChange={updateSort}
          visibleFields={visibleFields}
          onVisibleFieldsChange={updateVisibleFields}
          onItemSaved={handleItemSaved}
        />
      ) : view.kind === "kanban" && groupField && spaceId && typeId ? (
        <KanbanView rows={rows} fields={fields} groupField={groupField} spaceId={spaceId} typeId={typeId} />
      ) : view.kind === "kanban" ? (
        <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Escolha um campo de seleção pra agrupar as colunas.
        </p>
      ) : null}

      {view.kind === "table" && total > pageSize && (
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {total} {total === 1 ? "item" : "itens"}
          </span>
          <div className="flex items-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40" aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
