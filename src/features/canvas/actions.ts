"use server";

import type { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import type { Json } from "@/lib/supabase/database.types";
import type { BoxNode } from "./lib/bounding-box";
import {
  createEdgeWithMirror,
  deleteEdgeWithUnmirror,
  deleteNodeWithUnmirror,
  groupSelectedNodes,
  toggleEdgeLink,
} from "./lib/mutations";
import {
  ensureCanvas,
  ensureCanvasType,
  listCanvasEdges,
  listCanvasNodes,
  searchItemsForCanvas as searchItemsForCanvasQuery,
  type CanvasEdgeRow,
  type CanvasItemSearchResult,
  type CanvasNodeRow,
} from "./queries";
import {
  createEdgeSchema,
  createNodeSchema,
  nodePositionUpdateSchema,
  setNodeParentSchema,
  updateEdgeSchema,
  updateNodeDataSchema,
  updateNodeSizeSchema,
  updateNodeStyleSchema,
  updateViewportSchema,
} from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

/** "Novo canvas": cria o item (tipo de sistema Canvas, criado na hora se faltar) e o registro do canvas junto. */
export async function createCanvasItem(input: { title: string; spaceId: string | null }): Promise<Result<{ itemId: string }>> {
  const title = input.title.trim() || "Canvas sem título";
  const { supabase, user } = await requireOwner();

  const type = await ensureCanvasType(supabase, user.id);

  const { data: item, error } = await supabase
    .from("items")
    .insert({ owner_id: user.id, space_id: input.spaceId, type_id: type.id, title, status: "active", properties: {} as unknown as Json })
    .select("id")
    .single();
  if (error || !item) return fail(GENERIC_ERROR);

  await ensureCanvas(supabase, user.id, item.id);

  return ok({ itemId: item.id });
}

export async function createCanvasNode(input: z.input<typeof createNodeSchema>): Promise<Result<{ id: string }>> {
  const parsed = createNodeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const { data: last } = await supabase
    .from("canvas_nodes")
    .select("z_index")
    .eq("canvas_id", parsed.data.canvasId)
    .order("z_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("canvas_nodes")
    .insert({
      owner_id: user.id,
      canvas_id: parsed.data.canvasId,
      kind: parsed.data.kind,
      item_id: parsed.data.itemId ?? null,
      contact_id: parsed.data.contactId ?? null,
      attachment_id: parsed.data.attachmentId ?? null,
      data: parsed.data.data as unknown as Json,
      x: parsed.data.x,
      y: parsed.data.y,
      width: parsed.data.width ?? null,
      height: parsed.data.height ?? null,
      parent_node_id: parsed.data.parentNodeId ?? null,
      z_index: (last?.z_index ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return fail(GENERIC_ERROR);

  return ok({ id: data.id });
}

/** Salva posição em lote (5.5, "debounce de 500ms em lote") — um `UPDATE` por nó movido, uma chamada só. */
export async function updateNodePositions(input: z.input<typeof nodePositionUpdateSchema>): Promise<Result<null>> {
  const parsed = nodePositionUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const results = await Promise.all(
    parsed.data.map((node) => supabase.from("canvas_nodes").update({ x: node.x, y: node.y }).eq("id", node.id).eq("owner_id", user.id)),
  );
  if (results.some((r) => r.error)) return fail(GENERIC_ERROR);
  return ok(null);
}

export async function updateNodeSize(input: z.input<typeof updateNodeSizeSchema>): Promise<Result<null>> {
  const parsed = updateNodeSizeSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from("canvas_nodes")
    .update({ width: parsed.data.width, height: parsed.data.height })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  return ok(null);
}

/** Edita `data` do nó (texto da nota adesiva, url/título do link, rótulo do grupo). */
export async function updateNodeData(input: z.input<typeof updateNodeDataSchema>): Promise<Result<null>> {
  const parsed = updateNodeDataSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from("canvas_nodes")
    .update({ data: parsed.data.data as unknown as Json })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  return ok(null);
}

export async function updateNodeStyle(input: z.input<typeof updateNodeStyleSchema>): Promise<Result<null>> {
  const parsed = updateNodeStyleSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from("canvas_nodes")
    .update({ style: parsed.data.style as unknown as Json })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  return ok(null);
}

export async function setNodeParent(input: z.input<typeof setNodeParentSchema>): Promise<Result<null>> {
  const parsed = setNodeParentSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from("canvas_nodes")
    .update({ parent_node_id: parsed.data.parentNodeId })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  return ok(null);
}

export async function deleteNode(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  return deleteNodeWithUnmirror(supabase, user.id, id);
}

export async function groupNodes(canvasId: string, nodes: (BoxNode & { id: string })[]): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireOwner();
  return groupSelectedNodes(supabase, user.id, canvasId, nodes);
}

export async function createCanvasEdge(input: z.input<typeof createEdgeSchema>): Promise<Result<{ id: string }>> {
  const parsed = createEdgeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const { supabase, user } = await requireOwner();
  return createEdgeWithMirror(supabase, user.id, parsed.data);
}

/** Alterna `creates_link` de uma aresta já existente (5.5, botão 🔗 no rótulo da aresta). */
export async function toggleCanvasEdgeLink(id: string): Promise<Result<{ createsLink: boolean }>> {
  const { supabase, user } = await requireOwner();
  return toggleEdgeLink(supabase, user.id, id);
}

export async function updateCanvasEdge(input: z.input<typeof updateEdgeSchema>): Promise<Result<null>> {
  const parsed = updateEdgeSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const patch: { label?: string | null; style?: Json } = {};
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (parsed.data.style !== undefined) patch.style = parsed.data.style as unknown as Json;

  const { error } = await supabase.from("canvas_edges").update(patch).eq("id", parsed.data.id).eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  return ok(null);
}

export async function deleteCanvasEdge(id: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  return deleteEdgeWithUnmirror(supabase, user.id, id);
}

/** Salva a posição/zoom do canvas ao sair (5.5). */
export async function updateCanvasViewport(input: z.input<typeof updateViewportSchema>): Promise<Result<null>> {
  const parsed = updateViewportSchema.safeParse(input);
  if (!parsed.success) return fail(GENERIC_ERROR);
  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("canvases")
    .update({ viewport: { x: parsed.data.x, y: parsed.data.y, zoom: parsed.data.zoom } as unknown as Json })
    .eq("id", parsed.data.canvasId)
    .eq("owner_id", user.id);
  if (error) return fail(GENERIC_ERROR);
  return ok(null);
}

export async function searchItemsForCanvas(query: string): Promise<CanvasItemSearchResult[]> {
  const { supabase } = await requireOwner();
  return searchItemsForCanvasQuery(supabase, query);
}

/** Recarrega nós+arestas do servidor (5.5) — usado depois de "Agrupar", que mexe em várias linhas de uma vez (grupo novo + reposição dos filhos). */
export async function loadCanvasGraph(canvasId: string): Promise<{ nodes: CanvasNodeRow[]; edges: CanvasEdgeRow[] }> {
  const { supabase } = await requireOwner();
  const [nodes, edges] = await Promise.all([listCanvasNodes(supabase, canvasId), listCanvasEdges(supabase, canvasId)]);
  return { nodes, edges };
}
