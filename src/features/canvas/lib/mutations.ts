import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { fail, ok, type Result } from "@/lib/result";
import { computeBoundingBox, type BoxNode } from "./bounding-box";
import { resolveEdgeLink } from "./resolve-edge-link";

type Client = SupabaseClient<Database>;
const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";

async function findEdgeLink(supabase: Client, sourceNodeId: string, targetNodeId: string) {
  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("canvas_nodes").select("kind, item_id").eq("id", sourceNodeId).maybeSingle(),
    supabase.from("canvas_nodes").select("kind, item_id").eq("id", targetNodeId).maybeSingle(),
  ]);
  return source && target
    ? resolveEdgeLink({ kind: source.kind, itemId: source.item_id }, { kind: target.kind, itemId: target.item_id })
    : null;
}

/** Espelha uma aresta `creates_link` em `links` (5.5), se os dois nós forem nós de item. */
export async function mirrorEdgeLink(supabase: Client, ownerId: string, sourceNodeId: string, targetNodeId: string): Promise<void> {
  const link = await findEdgeLink(supabase, sourceNodeId, targetNodeId);
  if (!link) return;
  await supabase.from("links").insert({ owner_id: ownerId, source_id: link.sourceItemId, target_id: link.targetItemId, kind: "canvas" });
}

/** Desfaz o link espelhado (5.5) de uma aresta `creates_link`, se os dois nós ainda forem nós de item. */
export async function unmirrorEdgeLink(supabase: Client, ownerId: string, sourceNodeId: string, targetNodeId: string): Promise<void> {
  const link = await findEdgeLink(supabase, sourceNodeId, targetNodeId);
  if (!link) return;
  await supabase
    .from("links")
    .delete()
    .eq("source_id", link.sourceItemId)
    .eq("target_id", link.targetItemId)
    .eq("kind", "canvas")
    .eq("owner_id", ownerId);
}

/**
 * Apaga um nó — se ele tiver arestas `creates_link` (como origem ou
 * destino), desfaz o `links` espelhado de cada uma antes (a própria aresta
 * é apagada em cascata pelo banco, `on delete cascade`, 5.1 — mas o
 * `links` espelhado é uma tabela separada, o banco não sabe dela).
 */
export async function deleteNodeWithUnmirror(supabase: Client, ownerId: string, id: string): Promise<Result<null>> {
  const [{ data: asSource }, { data: asTarget }] = await Promise.all([
    supabase.from("canvas_edges").select("source_node_id, target_node_id").eq("source_node_id", id).eq("creates_link", true),
    supabase.from("canvas_edges").select("source_node_id, target_node_id").eq("target_node_id", id).eq("creates_link", true),
  ]);
  for (const edge of [...(asSource ?? []), ...(asTarget ?? [])]) {
    await unmirrorEdgeLink(supabase, ownerId, edge.source_node_id, edge.target_node_id);
  }

  const { error } = await supabase.from("canvas_nodes").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) return fail("Não foi possível excluir.");
  return ok(null);
}

/** "Agrupar" a seleção (5.5): cria um nó `group` do tamanho da seleção (+ margem) e aponta cada nó selecionado pra ele. */
export async function groupSelectedNodes(
  supabase: Client,
  ownerId: string,
  canvasId: string,
  nodes: (BoxNode & { id: string })[],
): Promise<Result<{ id: string }>> {
  if (nodes.length < 2) return fail("Selecione ao menos 2 itens pra agrupar.");

  const box = computeBoundingBox(nodes);
  const { data: group, error } = await supabase
    .from("canvas_nodes")
    .insert({
      owner_id: ownerId,
      canvas_id: canvasId,
      kind: "group",
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      data: { label: "Grupo" } as unknown as Json,
      z_index: 0,
    })
    .select("id")
    .single();
  if (error || !group) return fail(GENERIC_ERROR);

  // O React Flow trata x/y de um nó com `parentId` como relativo ao pai, não
  // mais absoluto — reposiciona cada filho pra manter o lugar visual onde já
  // estava (posição relativa = posição absoluta menos a origem do grupo).
  const results = await Promise.all(
    nodes.map((node) =>
      supabase
        .from("canvas_nodes")
        .update({ parent_node_id: group.id, x: node.x - box.x, y: node.y - box.y })
        .eq("id", node.id)
        .eq("owner_id", ownerId),
    ),
  );
  if (results.some((r) => r.error)) return fail(GENERIC_ERROR);

  return ok({ id: group.id });
}

export interface CreateEdgeMutationInput {
  canvasId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  createsLink: boolean;
}

export async function createEdgeWithMirror(supabase: Client, ownerId: string, input: CreateEdgeMutationInput): Promise<Result<{ id: string }>> {
  const { data: edge, error } = await supabase
    .from("canvas_edges")
    .insert({
      owner_id: ownerId,
      canvas_id: input.canvasId,
      source_node_id: input.sourceNodeId,
      target_node_id: input.targetNodeId,
      label: input.label ?? null,
      creates_link: input.createsLink,
    })
    .select("id")
    .single();
  if (error || !edge) return fail(GENERIC_ERROR);

  if (input.createsLink) {
    await mirrorEdgeLink(supabase, ownerId, input.sourceNodeId, input.targetNodeId);
  }

  return ok({ id: edge.id });
}

/** Alterna `creates_link` de uma aresta já existente — espelha/desfaz o `links` junto (5.5, botão 🔗 no rótulo da aresta). */
export async function toggleEdgeLink(supabase: Client, ownerId: string, id: string): Promise<Result<{ createsLink: boolean }>> {
  const { data: edge, error: readError } = await supabase
    .from("canvas_edges")
    .select("source_node_id, target_node_id, creates_link")
    .eq("id", id)
    .maybeSingle();
  if (readError || !edge) return fail(GENERIC_ERROR);

  const next = !edge.creates_link;
  const { error } = await supabase.from("canvas_edges").update({ creates_link: next }).eq("id", id).eq("owner_id", ownerId);
  if (error) return fail(GENERIC_ERROR);

  if (next) {
    await mirrorEdgeLink(supabase, ownerId, edge.source_node_id, edge.target_node_id);
  } else {
    await unmirrorEdgeLink(supabase, ownerId, edge.source_node_id, edge.target_node_id);
  }

  return ok({ createsLink: next });
}

/** Apaga a aresta — se ela tinha `creates_link`, desfaz o `links` espelhado antes (5.5, "cria e remove o link"). */
export async function deleteEdgeWithUnmirror(supabase: Client, ownerId: string, id: string): Promise<Result<null>> {
  const { data: edge } = await supabase.from("canvas_edges").select("source_node_id, target_node_id, creates_link").eq("id", id).maybeSingle();
  if (edge?.creates_link) {
    await unmirrorEdgeLink(supabase, ownerId, edge.source_node_id, edge.target_node_id);
  }

  const { error } = await supabase.from("canvas_edges").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) return fail("Não foi possível excluir.");
  return ok(null);
}
