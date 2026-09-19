"use client";

import { flexRender, type ColumnSizingState, type ColumnVisibilityState, type SortingState } from "@tanstack/react-table";
import { getCoreRowModel, useLegacyTable, type LegacyColumnDef } from "@tanstack/react-table/legacy";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FieldInput } from "@/components/fields/field-input";
import type { FieldDefinition } from "@/features/types/schemas";
import type { ViewItemRow } from "../queries";
import type { ViewSort } from "../schemas";

const STATUS_LABELS: Record<string, string> = { inbox: "Inbox", active: "Ativo", archived: "Arquivado" };

const headerClassName =
  "relative border-b border-black/[.08] px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:border-white/[.08] dark:text-zinc-400";

/**
 * Tabela (1.15) via `useLegacyTable` — o `@tanstack/react-table` instalado é
 * a v9 (arquitetura nova, baseada em signals), mas mantém uma camada de
 * compatibilidade v8 (`useLegacyTable`) de primeira classe, não um hack.
 * Optei por ela em vez da API nova: não tenho documentação real da v9 à mão
 * neste ambiente pra confiar numa arquitetura totalmente nova (ver AGENTS.md
 * sobre não usar conhecimento de treino desatualizado sem checar), e tudo
 * que esta tabela precisa (colunas, cabeçalho ordenável, mostrar/ocultar,
 * redimensionar) já é bem coberto pela API v8, que conheço com confiança.
 * Ordenação/filtro/paginação são "manuais" (`manual*: true`) porque quem
 * ordena/filtra/pagina de verdade é o servidor (`queryViewItems`) — a
 * tabela só recebe as linhas já prontas.
 */
export function TableView({
  rows,
  fields,
  sort,
  onSortChange,
  visibleFields,
  onVisibleFieldsChange,
  onItemSaved,
}: {
  rows: ViewItemRow[];
  fields: FieldDefinition[];
  sort: ViewSort[];
  onSortChange: (sort: ViewSort[]) => void;
  visibleFields?: string[];
  onVisibleFieldsChange: (fields: string[]) => void;
  onItemSaved: (itemId: string, updatedAt: string) => void;
}) {
  const hasType = fields.length > 0;

  const columns = useMemo<LegacyColumnDef<ViewItemRow, unknown>[]>(() => {
    const titleColumn: LegacyColumnDef<ViewItemRow, unknown> = {
      id: "title",
      header: "Título",
      cell: ({ row }) => (
        <Link href={`/itens/${row.original.id}`} className="text-black hover:underline dark:text-zinc-50">
          {row.original.title || "Sem título"}
        </Link>
      ),
    };

    if (hasType) {
      return [
        titleColumn,
        ...fields
          .filter((field) => !field.hidden)
          .map(
            (field): LegacyColumnDef<ViewItemRow, unknown> => ({
              id: field.key,
              header: field.label,
              cell: ({ row }) => (
                <FieldInput
                  itemId={row.original.id}
                  field={field}
                  value={row.original.properties[field.key]}
                  updatedAt={row.original.updatedAt}
                  onSaved={(updatedAt) => onItemSaved(row.original.id, updatedAt)}
                  compact
                />
              ),
            }),
          ),
      ];
    }

    // Sem tipo selecionado, mostra colunas comuns — "tipo"/"espaço" ficaram de fora aqui (ver docs/PROGRESSO.md, 1.15).
    return [
      titleColumn,
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => STATUS_LABELS[row.original.status] ?? row.original.status,
      },
      {
        id: "tags",
        header: "Tags",
        enableSorting: false,
        cell: ({ row }) => row.original.tags.map((tag) => `#${tag.name}`).join(" "),
      },
      {
        id: "updated_at",
        header: "Atualizado",
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString("pt-BR"),
      },
    ];
  }, [fields, hasType, onItemSaved]);

  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    visibleFields
      ? Object.fromEntries(columns.map((column) => [column.id as string, visibleFields.includes(column.id as string) || column.id === "title"]))
      : {},
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  const sortingState: SortingState = sort.map((s) => ({ id: s.field, desc: s.dir === "desc" }));

  const table = useLegacyTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    state: { sorting: sortingState, columnVisibility, columnSizing },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sortingState) : updater;
      onSortChange(next.map((s) => ({ field: s.id, dir: s.desc ? "desc" : "asc" })));
    },
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        onVisibleFieldsChange(
          Object.entries(next)
            .filter(([, visible]) => visible)
            .map(([id]) => id),
        );
        return next;
      });
    },
    onColumnSizingChange: setColumnSizing,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ width: header.getSize() }} className={headerClassName}>
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex items-center gap-1"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <ChevronUp className="h-3 w-3" />}
                      {header.column.getIsSorted() === "desc" && <ChevronDown className="h-3 w-3" />}
                    </button>
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-black/10 dark:hover:bg-white/10"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Nenhum item aqui ainda.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-black/[.06] dark:border-white/[.06]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ width: cell.column.getSize() }} className="px-3 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-black/[.08] pt-2 dark:border-white/[.08]">
        <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
          <Settings2 className="h-3.5 w-3.5" /> Colunas:
        </span>
        {table.getAllLeafColumns().map((column) => (
          <label key={column.id} className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} />
            {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
          </label>
        ))}
      </div>
    </div>
  );
}
