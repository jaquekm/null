import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fake-supabase";
import type { Database } from "@/lib/supabase/database.types";
import {
  createEdgeWithMirror,
  deleteEdgeWithUnmirror,
  deleteNodeWithUnmirror,
  groupSelectedNodes,
  toggleEdgeLink,
} from "./mutations";

const OWNER_ID = "owner-1";

function client(fake: FakeSupabase) {
  return fake as unknown as SupabaseClient<Database>;
}

function seedTwoItemNodes(fake: FakeSupabase, overrides: { sourceItemId?: string; targetItemId?: string } = {}) {
  fake.seed("canvas_nodes", [
    { id: "node-a", kind: "item", item_id: overrides.sourceItemId ?? "item-a" },
    { id: "node-b", kind: "item", item_id: overrides.targetItemId ?? "item-b" },
  ]);
}

describe("createEdgeWithMirror", () => {
  it("createsLink=true entre dois nós de item: cria a aresta e espelha o link", async () => {
    const fake = new FakeSupabase();
    seedTwoItemNodes(fake);

    const result = await createEdgeWithMirror(client(fake), OWNER_ID, {
      canvasId: "canvas-1",
      sourceNodeId: "node-a",
      targetNodeId: "node-b",
      createsLink: true,
    });

    expect(result.ok).toBe(true);
    expect(fake.rowsOf("canvas_edges")).toMatchObject([{ source_node_id: "node-a", target_node_id: "node-b", creates_link: true }]);
    expect(fake.rowsOf("links")).toMatchObject([{ owner_id: OWNER_ID, source_id: "item-a", target_id: "item-b", kind: "canvas" }]);
  });

  it("createsLink=false: cria só a aresta, sem link nenhum", async () => {
    const fake = new FakeSupabase();
    seedTwoItemNodes(fake);

    await createEdgeWithMirror(client(fake), OWNER_ID, { canvasId: "canvas-1", sourceNodeId: "node-a", targetNodeId: "node-b", createsLink: false });

    expect(fake.rowsOf("canvas_edges")).toHaveLength(1);
    expect(fake.rowsOf("links")).toHaveLength(0);
  });

  it("createsLink=true mas um dos nós não é de item: cria a aresta, mas não espelha link (não tem item pra ligar)", async () => {
    const fake = new FakeSupabase();
    fake.seed("canvas_nodes", [
      { id: "node-a", kind: "item", item_id: "item-a" },
      { id: "node-b", kind: "text", item_id: null },
    ]);

    await createEdgeWithMirror(client(fake), OWNER_ID, { canvasId: "canvas-1", sourceNodeId: "node-a", targetNodeId: "node-b", createsLink: true });

    expect(fake.rowsOf("canvas_edges")).toHaveLength(1);
    expect(fake.rowsOf("links")).toHaveLength(0);
  });
});

describe("toggleEdgeLink", () => {
  it("liga (false→true): espelha o link", async () => {
    const fake = new FakeSupabase();
    seedTwoItemNodes(fake);
    fake.seed("canvas_edges", [{ id: "edge-1", owner_id: OWNER_ID, source_node_id: "node-a", target_node_id: "node-b", creates_link: false }]);

    const result = await toggleEdgeLink(client(fake), OWNER_ID, "edge-1");

    expect(result).toEqual({ ok: true, data: { createsLink: true } });
    expect(fake.rowsOf("canvas_edges")[0]).toMatchObject({ creates_link: true });
    expect(fake.rowsOf("links")).toHaveLength(1);
  });

  it("desliga (true→false): desfaz o link espelhado", async () => {
    const fake = new FakeSupabase();
    seedTwoItemNodes(fake);
    fake.seed("canvas_edges", [{ id: "edge-1", owner_id: OWNER_ID, source_node_id: "node-a", target_node_id: "node-b", creates_link: true }]);
    fake.seed("links", [{ id: "link-1", owner_id: OWNER_ID, source_id: "item-a", target_id: "item-b", kind: "canvas" }]);

    const result = await toggleEdgeLink(client(fake), OWNER_ID, "edge-1");

    expect(result).toEqual({ ok: true, data: { createsLink: false } });
    expect(fake.rowsOf("canvas_edges")[0]).toMatchObject({ creates_link: false });
    expect(fake.rowsOf("links")).toHaveLength(0);
  });
});

describe("deleteEdgeWithUnmirror", () => {
  it("apaga a aresta e desfaz o link espelhado quando creates_link=true", async () => {
    const fake = new FakeSupabase();
    seedTwoItemNodes(fake);
    fake.seed("canvas_edges", [{ id: "edge-1", owner_id: OWNER_ID, source_node_id: "node-a", target_node_id: "node-b", creates_link: true }]);
    fake.seed("links", [{ id: "link-1", owner_id: OWNER_ID, source_id: "item-a", target_id: "item-b", kind: "canvas" }]);

    await deleteEdgeWithUnmirror(client(fake), OWNER_ID, "edge-1");

    expect(fake.rowsOf("canvas_edges")).toHaveLength(0);
    expect(fake.rowsOf("links")).toHaveLength(0);
  });

  it("apaga a aresta sem mexer em links quando creates_link=false", async () => {
    const fake = new FakeSupabase();
    seedTwoItemNodes(fake);
    fake.seed("canvas_edges", [{ id: "edge-1", owner_id: OWNER_ID, source_node_id: "node-a", target_node_id: "node-b", creates_link: false }]);
    fake.seed("links", [{ id: "link-1", owner_id: OWNER_ID, source_id: "item-x", target_id: "item-y", kind: "canvas" }]);

    await deleteEdgeWithUnmirror(client(fake), OWNER_ID, "edge-1");

    expect(fake.rowsOf("canvas_edges")).toHaveLength(0);
    expect(fake.rowsOf("links")).toHaveLength(1);
  });
});

describe("deleteNodeWithUnmirror", () => {
  it("apaga o nó e desfaz o link de toda aresta creates_link que o toca, como origem ou destino", async () => {
    const fake = new FakeSupabase();
    fake.seed("canvas_nodes", [
      { id: "node-a", owner_id: OWNER_ID, kind: "item", item_id: "item-a" },
      { id: "node-b", owner_id: OWNER_ID, kind: "item", item_id: "item-b" },
      { id: "node-c", owner_id: OWNER_ID, kind: "item", item_id: "item-c" },
    ]);
    fake.seed("canvas_edges", [
      { id: "edge-1", source_node_id: "node-a", target_node_id: "node-b", creates_link: true },
      { id: "edge-2", source_node_id: "node-c", target_node_id: "node-a", creates_link: true },
    ]);
    fake.seed("links", [
      { id: "link-1", owner_id: OWNER_ID, source_id: "item-a", target_id: "item-b", kind: "canvas" },
      { id: "link-2", owner_id: OWNER_ID, source_id: "item-c", target_id: "item-a", kind: "canvas" },
    ]);

    const result = await deleteNodeWithUnmirror(client(fake), OWNER_ID, "node-a");

    expect(result).toEqual({ ok: true, data: null });
    expect(fake.rowsOf("canvas_nodes").map((r) => r.id)).toEqual(["node-b", "node-c"]);
    expect(fake.rowsOf("links")).toHaveLength(0);
  });

  it("nó sem aresta creates_link nenhuma: só apaga o nó, não mexe em links", async () => {
    const fake = new FakeSupabase();
    fake.seed("canvas_nodes", [{ id: "node-a", owner_id: OWNER_ID, kind: "text", item_id: null }]);
    fake.seed("links", [{ id: "link-1", owner_id: OWNER_ID, source_id: "item-x", target_id: "item-y", kind: "canvas" }]);

    await deleteNodeWithUnmirror(client(fake), OWNER_ID, "node-a");

    expect(fake.rowsOf("canvas_nodes")).toHaveLength(0);
    expect(fake.rowsOf("links")).toHaveLength(1);
  });
});

describe("groupSelectedNodes", () => {
  it("cria o grupo do tamanho da seleção e reposiciona os filhos como relativos ao grupo", async () => {
    const fake = new FakeSupabase();
    fake.seed("canvas_nodes", [
      { id: "node-a", owner_id: OWNER_ID, x: 100, y: 100, width: 160, height: 80 },
      { id: "node-b", owner_id: OWNER_ID, x: 400, y: 300, width: 200, height: 100 },
    ]);

    const result = await groupSelectedNodes(client(fake), OWNER_ID, "canvas-1", [
      { id: "node-a", x: 100, y: 100, width: 160, height: 80 },
      { id: "node-b", x: 400, y: 300, width: 200, height: 100 },
    ]);

    expect(result.ok).toBe(true);
    const groupId = result.ok ? result.data.id : "";
    const group = fake.rowsOf("canvas_nodes").find((r) => r.id === groupId);
    expect(group).toMatchObject({ kind: "group", x: 76, y: 76, width: 548, height: 348 });

    const nodeA = fake.rowsOf("canvas_nodes").find((r) => r.id === "node-a");
    const nodeB = fake.rowsOf("canvas_nodes").find((r) => r.id === "node-b");
    expect(nodeA).toMatchObject({ parent_node_id: groupId, x: 24, y: 24 });
    expect(nodeB).toMatchObject({ parent_node_id: groupId, x: 324, y: 224 });
  });

  it("menos de 2 nós selecionados: falha sem criar nada", async () => {
    const fake = new FakeSupabase();
    const result = await groupSelectedNodes(client(fake), OWNER_ID, "canvas-1", [{ id: "node-a", x: 0, y: 0, width: null, height: null }]);

    expect(result.ok).toBe(false);
    expect(fake.rowsOf("canvas_nodes")).toHaveLength(0);
  });
});
