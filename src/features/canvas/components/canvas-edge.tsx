"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";

export interface CanvasEdgeData extends Record<string, unknown> {
  label?: string | null;
  createsLink?: boolean;
  onLabelChange?: (value: string) => void;
  onToggleLink?: () => void;
  onDelete?: () => void;
}

/** Aresta do canvas (5.5) — rótulo editável inline + alternar "cria link entre itens" + apagar, tudo no próprio meio da linha. */
export function CanvasEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const edgeData = data as CanvasEdgeData | undefined;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          className="nodrag nopan flex items-center gap-1 rounded-full border border-black/[.1] bg-white px-2 py-0.5 text-xs shadow-sm dark:border-white/[.12] dark:bg-zinc-900"
        >
          <input
            defaultValue={edgeData?.label ?? ""}
            placeholder="rótulo"
            onBlur={(e) => edgeData?.onLabelChange?.(e.target.value)}
            className="w-16 bg-transparent text-center text-zinc-700 outline-none dark:text-zinc-200"
          />
          <button
            type="button"
            title={edgeData?.createsLink ? "Liga os dois itens (clique pra desligar)" : "Só visual (clique pra ligar os itens)"}
            onClick={edgeData?.onToggleLink}
            className={edgeData?.createsLink ? "text-black dark:text-zinc-50" : "text-zinc-300 dark:text-zinc-600"}
          >
            🔗
          </button>
          <button type="button" title="Apagar aresta" onClick={edgeData?.onDelete} className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400">
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
