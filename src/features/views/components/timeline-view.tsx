"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateItemProperty } from "@/features/items/actions";
import type { FieldDefinition } from "@/features/types/schemas";
import {
  computeBarPosition,
  computeGanttWindow,
  dateToPercent,
  ganttZooms,
  parseFieldDate,
  pixelsToDays,
  shiftFieldDateValue,
  shiftGanttWindow,
  todayPercent,
  type GanttWindow,
  type GanttZoom,
} from "../lib/gantt-layout";
import type { ViewItemRow } from "../queries";

const ROW_HEIGHT = 36;
const ZOOM_LABELS: Record<GanttZoom, string> = { week: "Semana", month: "Mês", quarter: "Trimestre" };
const NO_GROUP = "__sem_grupo__";

interface TimelineRow {
  row: ViewItemRow;
  start: Date;
  end: Date;
}

type DragMode = "move" | "resize-start" | "resize-end";
interface DragState {
  rowId: string;
  mode: DragMode;
  startClientX: number;
  deltaDays: number;
}

function groupLabel(row: ViewItemRow, groupField: FieldDefinition | undefined): string {
  if (!groupField) return NO_GROUP;
  const value = row.properties[groupField.key];
  if (typeof value !== "string" || !value) return NO_GROUP;
  return groupField.options?.find((option) => option.id === value)?.label ?? value;
}

/**
 * Linha do tempo / Gantt simples (5.4): barras entre `startField` e
 * `endField`; arrastar move as duas datas, redimensionar as bordas move só
 * uma; agrupa por `groupBy` (reaproveita a config do Kanban); linha do
 * "hoje"; zoom semana/mês/trimestre; setas simples de dependência
 * (`dependsOnField`, um campo `relation`). Não há biblioteca de Gantt na
 * stack — implementado com `<div>`s posicionados em %, mesma técnica de
 * `lib/gantt-layout.ts` (testada) usada pelo planejador do dia (3.6).
 */
export function TimelineView({
  rows: initialRows,
  startField,
  endField,
  groupField,
  dependsOnField,
}: {
  rows: ViewItemRow[];
  startField: FieldDefinition;
  endField: FieldDefinition;
  groupField?: FieldDefinition;
  dependsOnField?: FieldDefinition;
}) {
  const [rows, setRows] = useState(initialRows);
  const [zoom, setZoom] = useState<GanttZoom>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [, startTransition] = useTransition();
  const trackRef = useRef<HTMLDivElement>(null);

  const window: GanttWindow = useMemo(() => computeGanttWindow(anchor, zoom), [anchor, zoom]);

  const timelineRows: TimelineRow[] = useMemo(() => {
    return rows
      .map((row) => {
        const start = parseFieldDate(row.properties[startField.key], startField.type as "date" | "datetime");
        const end = parseFieldDate(row.properties[endField.key], endField.type as "date" | "datetime");
        return start && end ? { row, start, end: end < start ? start : end } : null;
      })
      .filter((r): r is TimelineRow => r !== null);
  }, [rows, startField, endField]);

  const withoutDates = rows.length - timelineRows.length;

  const groups = useMemo(() => {
    const map = new Map<string, TimelineRow[]>();
    for (const item of timelineRows) {
      const key = groupLabel(item.row, groupField);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [timelineRows, groupField]);

  const flatRows = useMemo(() => groups.flatMap(([, items]) => items), [groups]);
  const rowIndexById = useMemo(() => new Map(flatRows.map((item, index) => [item.row.id, index])), [flatRows]);

  const today = todayPercent(window);

  function displayedRange(item: TimelineRow): { start: Date; end: Date } {
    if (!drag || drag.rowId !== item.row.id) return item;
    const oneDay = 24 * 60 * 60 * 1000;
    if (drag.mode === "move") {
      return { start: new Date(item.start.getTime() + drag.deltaDays * oneDay), end: new Date(item.end.getTime() + drag.deltaDays * oneDay) };
    }
    if (drag.mode === "resize-start") {
      const start = new Date(item.start.getTime() + drag.deltaDays * oneDay);
      return { start: start < item.end ? start : item.end, end: item.end };
    }
    const end = new Date(item.end.getTime() + drag.deltaDays * oneDay);
    return { start: item.start, end: end > item.start ? end : item.start };
  }

  function handlePointerDown(event: React.PointerEvent, rowId: string, mode: DragMode) {
    event.stopPropagation();
    (event.target as Element).setPointerCapture(event.pointerId);
    setDrag({ rowId, mode, startClientX: event.clientX, deltaDays: 0 });
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!drag) return;
    const width = trackRef.current?.offsetWidth ?? 0;
    const deltaDays = pixelsToDays(event.clientX - drag.startClientX, width, window);
    setDrag((current) => (current ? { ...current, deltaDays } : current));
  }

  function commitDrag() {
    if (!drag || drag.deltaDays === 0) {
      setDrag(null);
      return;
    }
    const item = timelineRows.find((t) => t.row.id === drag.rowId);
    if (!item) {
      setDrag(null);
      return;
    }
    const { mode, deltaDays } = drag;
    setDrag(null);

    startTransition(async () => {
      let updatedAt = item.row.updatedAt;
      const nextProperties: Record<string, unknown> = {};

      if (mode === "move" || mode === "resize-start") {
        const value = shiftFieldDateValue(item.row.properties[startField.key] as string, deltaDays, startField.type as "date" | "datetime");
        const formData = new FormData();
        formData.append("value", value);
        const result = await updateItemProperty(item.row.id, startField.key, updatedAt, { ok: true, data: null }, formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        updatedAt = result.data?.updatedAt ?? updatedAt;
        nextProperties[startField.key] = value;
      }

      if (mode === "move" || mode === "resize-end") {
        const value = shiftFieldDateValue(item.row.properties[endField.key] as string, deltaDays, endField.type as "date" | "datetime");
        const formData = new FormData();
        formData.append("value", value);
        const result = await updateItemProperty(item.row.id, endField.key, updatedAt, { ok: true, data: null }, formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        updatedAt = result.data?.updatedAt ?? updatedAt;
        nextProperties[endField.key] = value;
      }

      setRows((current) =>
        current.map((row) => (row.id === item.row.id ? { ...row, updatedAt, properties: { ...row.properties, ...nextProperties } } : row)),
      );
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setAnchor(shiftGanttWindow(window, zoom, -1).start)} aria-label="Anterior" className="rounded-lg p-1 hover:bg-black/[.04] dark:hover:bg-white/[.06]">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setAnchor(new Date())} className="text-xs text-zinc-500 hover:underline dark:text-zinc-400">
          Hoje
        </button>
        <button type="button" onClick={() => setAnchor(shiftGanttWindow(window, zoom, 1).start)} aria-label="Próxima" className="rounded-lg p-1 hover:bg-black/[.04] dark:hover:bg-white/[.06]">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {window.start.toLocaleDateString("pt-BR")} – {window.end.toLocaleDateString("pt-BR")}
        </span>
        <div className="ml-auto flex gap-1">
          {ganttZooms.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                zoom === z ? "bg-black/[.06] font-medium text-black dark:bg-white/[.1] dark:text-zinc-50" : "text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
              }`}
            >
              {ZOOM_LABELS[z]}
            </button>
          ))}
        </div>
      </div>

      {withoutDates > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {withoutDates} {withoutDates === 1 ? "item não aparece" : "itens não aparecem"} aqui por faltar &quot;{startField.label}&quot; ou &quot;{endField.label}&quot;.
        </p>
      )}

      {flatRows.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">Nenhum item com as duas datas preenchidas.</p>
      ) : (
        <div className="flex overflow-x-auto rounded-lg border border-black/[.08] dark:border-white/[.08]">
          <div className="flex w-44 shrink-0 flex-col border-r border-black/[.08] dark:border-white/[.08]">
            <div style={{ height: ROW_HEIGHT }} className="shrink-0 border-b border-black/[.08] dark:border-white/[.08]" />
            {groups.map(([label, items]) => (
              <div key={label}>
                {label !== NO_GROUP && (
                  <div style={{ height: ROW_HEIGHT }} className="flex items-center px-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {label}
                  </div>
                )}
                {items.map((item) => (
                  <Link
                    key={item.row.id}
                    href={`/itens/${item.row.id}`}
                    style={{ height: ROW_HEIGHT }}
                    className="flex items-center truncate px-2 text-xs text-black hover:underline dark:text-zinc-50"
                  >
                    {item.row.title || "Sem título"}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div ref={trackRef} className="relative min-w-[600px] flex-1" onPointerMove={handlePointerMove} onPointerUp={commitDrag}>
            <div style={{ height: ROW_HEIGHT }} className="shrink-0 border-b border-black/[.08] dark:border-white/[.08]" />
            {today !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-red-400 dark:bg-red-500" style={{ left: `${today}%` }} title="Hoje" />
            )}

            {groups.map(([label, items]) => (
              <div key={label}>
                {label !== NO_GROUP && <div style={{ height: ROW_HEIGHT }} className="border-b border-black/[.04] dark:border-white/[.04]" />}
                {items.map((item) => {
                  const { start, end } = displayedRange(item);
                  const bar = computeBarPosition(start, end, window);
                  return (
                    <div key={item.row.id} style={{ height: ROW_HEIGHT }} className="relative border-b border-black/[.04] dark:border-white/[.04]">
                      <div
                        onPointerDown={(event) => handlePointerDown(event, item.row.id, "move")}
                        className="absolute top-1.5 bottom-1.5 flex cursor-grab items-center rounded bg-blue-500/80 px-1 text-[11px] text-white select-none"
                        style={{ left: `${bar.leftPercent}%`, width: `${bar.widthPercent}%` }}
                      >
                        <div
                          onPointerDown={(event) => handlePointerDown(event, item.row.id, "resize-start")}
                          className="absolute -left-1 top-0 h-full w-2 cursor-ew-resize"
                        />
                        <span className="truncate">{item.row.title}</span>
                        <div
                          onPointerDown={(event) => handlePointerDown(event, item.row.id, "resize-end")}
                          className="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {dependsOnField && (
              <DependencyArrows rows={flatRows} rowIndexById={rowIndexById} dependsOnField={dependsOnField} window={window} drag={drag} displayedRange={displayedRange} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DependencyArrows({
  rows,
  rowIndexById,
  dependsOnField,
  window,
  displayedRange,
}: {
  rows: TimelineRow[];
  rowIndexById: Map<string, number>;
  dependsOnField: FieldDefinition;
  window: GanttWindow;
  drag: DragState | null;
  displayedRange: (item: TimelineRow) => { start: Date; end: Date };
}) {
  const byId = new Map(rows.map((item) => [item.row.id, item]));
  const headerOffset = ROW_HEIGHT;

  const lines = rows.flatMap((item) => {
    const dependsOn = item.row.properties[dependsOnField.key];
    const dependsOnIds = Array.isArray(dependsOn) ? dependsOn.filter((id): id is string => typeof id === "string") : [];
    return dependsOnIds
      .map((sourceId) => {
        const source = byId.get(sourceId);
        const sourceIndex = rowIndexById.get(sourceId);
        const targetIndex = rowIndexById.get(item.row.id);
        if (!source || sourceIndex === undefined || targetIndex === undefined) return null;

        const sourceRange = displayedRange(source);
        const targetRange = displayedRange(item);
        const x1 = dateToPercent(sourceRange.end, window);
        const x2 = dateToPercent(targetRange.start, window);
        const y1 = headerOffset + sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        const y2 = headerOffset + targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
        return { key: `${sourceId}-${item.row.id}`, x1, y1, x2, y2 };
      })
      .filter((line): line is { key: string; x1: number; y1: number; x2: number; y2: number } => line !== null);
  });

  if (lines.length === 0) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
      {lines.map((line) => (
        <line key={line.key} x1={`${line.x1}%`} y1={line.y1} x2={`${line.x2}%`} y2={line.y2} stroke="currentColor" strokeWidth={1} className="text-zinc-400 dark:text-zinc-600" markerEnd="url(#gantt-arrow)" />
      ))}
      <defs>
        <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" className="fill-zinc-400 dark:fill-zinc-600" />
        </marker>
      </defs>
    </svg>
  );
}
