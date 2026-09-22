"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import { ImagePlus, Lock, Maximize2, Shapes, Type as TypeIcon, Unlock, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadAttachment } from "@/features/attachments/lib/upload-file";
import {
  createCanvasEdge,
  createCanvasNode,
  deleteCanvasEdge,
  deleteNode,
  groupNodes,
  loadCanvasGraph,
  searchItemsForCanvas,
  toggleCanvasEdgeLink,
  updateCanvasEdge,
  updateCanvasViewport,
  updateNodeData,
  updateNodePositions,
  updateNodeStyle,
} from "../actions";
import type { CanvasEdgeRow, CanvasNodeRow } from "../queries";
import { CanvasEdge, type CanvasEdgeData } from "./canvas-edge";
import { canvasNodeTypes, type CanvasFlowNode } from "./canvas-nodes";

const edgeTypes = { canvas: CanvasEdge };
const POSITION_SAVE_DEBOUNCE_MS = 500;

interface CanvasWorkspaceProps {
  itemTitle: string;
  canvasId: string;
  initialViewport: { x: number; y: number; zoom: number };
  initialNodes: CanvasNodeRow[];
  initialEdges: CanvasEdgeRow[];
}

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <CanvasWorkspaceInner {...props} />
    </ReactFlowProvider>
  );
}

function toFlowNode(row: CanvasNodeRow): CanvasFlowNode {
  const base = {
    id: row.id,
    position: { x: row.x, y: row.y },
    zIndex: row.zIndex,
    draggable: row.style.locked !== true,
    ...(row.width != null ? { width: row.width } : {}),
    ...(row.height != null ? { height: row.height } : {}),
    ...(row.parentNodeId ? { parentId: row.parentNodeId } : {}),
  };
  switch (row.kind) {
    case "item":
      return { ...base, type: "item", data: { itemId: row.itemId!, title: row.itemTitle ?? "Sem título", icon: row.itemIcon, typeSlug: row.itemTypeSlug } };
    case "contact":
      return { ...base, type: "contact", data: { contactId: row.contactId!, name: row.contactName ?? "Contato" } };
    case "image":
      return { ...base, type: "image", data: { attachmentId: row.attachmentId! } };
    case "link":
      return { ...base, type: "link", data: { url: (row.data.url as string) ?? "", title: row.data.title as string | undefined } };
    case "group":
      return { ...base, type: "group", data: { label: (row.data.label as string) ?? "Grupo" } };
    case "text":
    default:
      return { ...base, type: "text", data: { text: (row.data.text as string) ?? "" } };
  }
}

/** Junta os callbacks de edição (não ficam guardados no estado — evita fechar sobre `setNodes` na hora de montar o estado inicial). */
function attachNodeHandlers(
  node: CanvasFlowNode,
  handlers: { onTextChange: (id: string, text: string) => void; onGroupLabelChange: (id: string, label: string) => void },
): CanvasFlowNode {
  if (node.type === "text") return { ...node, data: { ...node.data, onChange: (v: string) => handlers.onTextChange(node.id, v) } };
  if (node.type === "group") return { ...node, data: { ...node.data, onChange: (v: string) => handlers.onGroupLabelChange(node.id, v) } };
  return node;
}

function toFlowEdge(row: CanvasEdgeRow): Edge<CanvasEdgeData> {
  return { id: row.id, source: row.sourceNodeId, target: row.targetNodeId, type: "canvas", data: { label: row.label, createsLink: row.createsLink } };
}

function attachEdgeHandlers(
  edge: Edge<CanvasEdgeData>,
  handlers: { onLabelChange: (id: string, value: string) => void; onToggleLink: (id: string) => void; onDelete: (id: string) => void },
): Edge<CanvasEdgeData> {
  return {
    ...edge,
    data: {
      ...edge.data,
      onLabelChange: (v: string) => handlers.onLabelChange(edge.id, v),
      onToggleLink: () => handlers.onToggleLink(edge.id),
      onDelete: () => handlers.onDelete(edge.id),
    },
  };
}

function CanvasWorkspaceInner({ itemTitle, canvasId, initialViewport, initialNodes, initialEdges }: CanvasWorkspaceProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>(initialNodes.map(toFlowNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<CanvasEdgeData>>(initialEdges.map(toFlowEdge));
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [, startPending] = useTransition();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; title: string }[]>([]);
  const [previewNode, setPreviewNode] = useState<{ itemId: string; title: string; icon: string | null } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<CanvasFlowNode[]>([]);

  const pendingPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = useCallback((id: string, text: string) => void updateNodeData({ id, data: { text } }), []);
  const handleGroupLabelChange = useCallback((id: string, label: string) => void updateNodeData({ id, data: { label } }), []);
  const handleEdgeLabelChange = useCallback((id: string, label: string) => void updateCanvasEdge({ id, label }), []);

  const handleDeleteEdge = useCallback(
    (id: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== id));
      void deleteCanvasEdge(id);
    },
    [setEdges],
  );

  const handleToggleLink = useCallback(
    (id: string) => {
      startPending(async () => {
        const result = await toggleCanvasEdgeLink(id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setEdges((current) => current.map((edge) => (edge.id === id ? { ...edge, data: { ...edge.data, createsLink: result.data.createsLink } } : edge)));
      });
    },
    [setEdges, startPending],
  );

  const displayNodes = useMemo(
    () => nodes.map((node) => attachNodeHandlers(node, { onTextChange: handleTextChange, onGroupLabelChange: handleGroupLabelChange })),
    [nodes, handleTextChange, handleGroupLabelChange],
  );
  const displayEdges = useMemo(
    () => edges.map((edge) => attachEdgeHandlers(edge, { onLabelChange: handleEdgeLabelChange, onToggleLink: handleToggleLink, onDelete: handleDeleteEdge })),
    [edges, handleEdgeLabelChange, handleToggleLink, handleDeleteEdge],
  );

  function schedulePositionSave(ids: { id: string; x: number; y: number }[]) {
    for (const item of ids) pendingPositions.current.set(item.id, { x: item.x, y: item.y });
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      const updates = Array.from(pendingPositions.current, ([id, pos]) => ({ id, ...pos }));
      pendingPositions.current.clear();
      if (updates.length > 0) void updateNodePositions(updates);
    }, POSITION_SAVE_DEBOUNCE_MS);
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      startPending(async () => setSearchResults(await searchItemsForCanvas(searchQuery)));
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchQuery, startPending]);

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, []);

  function getCenterFlowPosition() {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
  }

  async function addNode(input: Parameters<typeof createCanvasNode>[0]) {
    const result = await createCanvasNode(input);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const row: CanvasNodeRow = {
      id: result.data.id,
      kind: input.kind,
      itemId: input.itemId ?? null,
      contactId: input.contactId ?? null,
      attachmentId: input.attachmentId ?? null,
      data: (input.data as Record<string, unknown>) ?? {},
      x: input.x,
      y: input.y,
      width: input.width ?? null,
      height: input.height ?? null,
      parentNodeId: null,
      style: {},
      zIndex: 0,
      itemTitle: null,
      itemIcon: null,
      itemTypeSlug: null,
      contactName: null,
    };
    setNodes((current) => [...current, toFlowNode(row)]);
  }

  function handleAddText() {
    const pos = getCenterFlowPosition();
    void addNode({ canvasId, kind: "text", x: pos.x, y: pos.y, data: { text: "" } });
  }

  function handlePaneDoubleClick(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("react-flow__pane")) return;
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    void addNode({ canvasId, kind: "text", x: pos.x, y: pos.y, data: { text: "" } });
  }

  async function handlePaste(event: React.ClipboardEvent) {
    const imageFile = Array.from(event.clipboardData.files ?? []).find((file) => file.type.startsWith("image/"));
    if (imageFile) {
      event.preventDefault();
      const pos = getCenterFlowPosition();
      const result = await uploadAttachment(null, imageFile, () => {});
      if (!result.ok || !result.data) {
        toast.error(!result.ok ? result.error : "Não foi possível colar a imagem.");
        return;
      }
      void addNode({ canvasId, kind: "image", x: pos.x, y: pos.y, attachmentId: result.data.attachment.id, data: {} });
      return;
    }
    const text = event.clipboardData.getData("text/plain").trim();
    if (/^https?:\/\//.test(text)) {
      event.preventDefault();
      const pos = getCenterFlowPosition();
      void addNode({ canvasId, kind: "link", x: pos.x, y: pos.y, data: { url: text } });
    }
  }

  function handleDragStart(event: React.DragEvent, item: { id: string; title: string }) {
    event.dataTransfer.setData("application/x-canvas-item", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/x-canvas-item");
    if (!raw) return;
    const item = JSON.parse(raw) as { id: string; title: string };
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    void addNode({ canvasId, kind: "item", x: pos.x, y: pos.y, itemId: item.id, data: {} });
  }

  async function handleGroupSelection() {
    if (selectedNodes.length < 2) {
      toast.error("Selecione ao menos 2 itens pra agrupar.");
      return;
    }
    const boxNodes = selectedNodes.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y, width: node.width ?? null, height: node.height ?? null }));
    const result = await groupNodes(canvasId, boxNodes);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const graph = await loadCanvasGraph(canvasId);
    setNodes(graph.nodes.map(toFlowNode));
    setEdges(graph.edges.map(toFlowEdge));
  }

  function handleToggleLock() {
    const shouldLock = selectedNodes.some((node) => node.draggable !== false);
    for (const node of selectedNodes) {
      void updateNodeStyle({ id: node.id, style: { locked: shouldLock } });
    }
    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    setNodes((current) => current.map((node) => (selectedIds.has(node.id) ? { ...node, draggable: !shouldLock } : node)));
  }

  async function handleExportPng() {
    const viewport = wrapperRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewport) return;
    try {
      const dataUrl = await toPng(viewport, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${itemTitle || "canvas"}.png`;
      link.click();
    } catch {
      toast.error("Não foi possível exportar a imagem.");
    }
  }

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) return;
    const source = connection.source;
    const target = connection.target;
    void (async () => {
      const result = await createCanvasEdge({ canvasId, sourceNodeId: source, targetNodeId: target, createsLink: false });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEdges((current) => [...current, toFlowEdge({ id: result.data.id, sourceNodeId: source, targetNodeId: target, label: null, style: {}, createsLink: false })]);
    })();
  }

  function handleNodeDoubleClick(_event: React.MouseEvent, node: CanvasFlowNode) {
    if (node.type !== "item") return;
    setPreviewNode({ itemId: node.data.itemId, title: node.data.title, icon: node.data.icon });
  }

  function handleSelectionChange({ nodes: selected }: OnSelectionChangeParams) {
    setSelectedNodes(selected as CanvasFlowNode[]);
  }

  const canLock = selectedNodes.length > 0;
  const allSelectedLocked = canLock && selectedNodes.every((node) => node.draggable === false);

  return (
    <div className="flex h-dvh w-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[.08] px-4 py-2 dark:border-white/[.08]">
        <div className="flex items-center gap-2 text-sm">
          <a href="/inbox" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            Hub
          </a>
          <span className="text-zinc-300 dark:text-zinc-600">/</span>
          <span className="font-medium text-black dark:text-zinc-50">🗺️ {itemTitle || "Canvas sem título"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <button type="button" onClick={handleAddText} className="flex items-center gap-1 rounded-lg border border-black/[.12] px-2.5 py-1.5 dark:border-white/[.16]">
            <TypeIcon className="h-4 w-4" /> Texto
          </button>
          <button
            type="button"
            onClick={() => void handleGroupSelection()}
            disabled={selectedNodes.length < 2}
            className="flex items-center gap-1 rounded-lg border border-black/[.12] px-2.5 py-1.5 disabled:opacity-40 dark:border-white/[.16]"
          >
            <Shapes className="h-4 w-4" /> Agrupar
          </button>
          <button
            type="button"
            onClick={handleToggleLock}
            disabled={!canLock}
            className="flex items-center gap-1 rounded-lg border border-black/[.12] px-2.5 py-1.5 disabled:opacity-40 dark:border-white/[.16]"
          >
            {allSelectedLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            Travar
          </button>
          <button type="button" onClick={() => fitView({ padding: 0.2 })} className="flex items-center gap-1 rounded-lg border border-black/[.12] px-2.5 py-1.5 dark:border-white/[.16]">
            <Maximize2 className="h-4 w-4" /> Centralizar
          </button>
          <button type="button" onClick={() => void handleExportPng()} className="rounded-lg border border-black/[.12] px-2.5 py-1.5 dark:border-white/[.16]">
            Exportar PNG
          </button>
          <button type="button" onClick={() => setSidebarOpen((v) => !v)} className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-background">
            <ImagePlus className="h-4 w-4" /> Adicionar item
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <div ref={wrapperRef} className="relative flex-1" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onPaste={(e) => void handlePaste(e)}>
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={canvasNodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeDragStop={(_e, node) => schedulePositionSave([{ id: node.id, x: node.position.x, y: node.position.y }])}
            onSelectionDragStop={(_e, dragged) => schedulePositionSave(dragged.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })))}
            onNodesDelete={(deleted) => deleted.forEach((node) => void deleteNode(node.id))}
            onEdgesDelete={(deleted) => deleted.forEach((edge) => void deleteCanvasEdge(edge.id))}
            onNodeDoubleClick={handleNodeDoubleClick}
            onDoubleClick={handlePaneDoubleClick}
            onSelectionChange={handleSelectionChange}
            onMoveEnd={(_e, viewport) => void updateCanvasViewport({ canvasId, x: viewport.x, y: viewport.y, zoom: viewport.zoom })}
            defaultViewport={initialViewport}
            colorMode="system"
            fitView={initialNodes.length === 0}
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls />
            <MiniMap pannable zoomable />
            {nodes.length === 0 && (
              <Panel
                position="top-center"
                className="rounded-lg border border-black/[.08] bg-white px-4 py-2 text-sm text-zinc-500 shadow-sm dark:border-white/[.08] dark:bg-zinc-900 dark:text-zinc-400"
              >
                Clique duas vezes no vazio pra criar uma nota, ou arraste um item da busca (canto superior direito).
              </Panel>
            )}
          </ReactFlow>
        </div>

        {sidebarOpen && (
          <aside className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto border-l border-black/[.08] p-3 dark:border-white/[.08]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-black dark:text-zinc-50">Arrastar item</span>
              <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar itens…"
              className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20"
            />
            <ul className="flex flex-col gap-1">
              {searchResults.map((item) => (
                <li
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  className="cursor-grab truncate rounded-lg border border-black/[.08] px-2.5 py-1.5 text-sm active:cursor-grabbing dark:border-white/[.08]"
                >
                  {item.title || "Sem título"}
                </li>
              ))}
              {searchQuery.trim() && searchResults.length === 0 && <li className="text-xs text-zinc-400 dark:text-zinc-500">Nada encontrado.</li>}
            </ul>
          </aside>
        )}

        {previewNode && (
          <aside className="absolute inset-y-0 right-0 flex w-80 flex-col gap-3 border-l border-black/[.08] bg-white p-4 shadow-xl dark:border-white/[.08] dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Item</span>
              <button type="button" onClick={() => setPreviewNode(null)} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-lg text-black dark:text-zinc-50">
              <span>{previewNode.icon || "•"}</span>
              <span className="min-w-0 truncate font-medium">{previewNode.title}</span>
            </div>
            <a href={`/itens/${previewNode.itemId}`} className="text-sm text-blue-600 underline dark:text-blue-400">
              Abrir item completo →
            </a>
          </aside>
        )}
      </div>
    </div>
  );
}
