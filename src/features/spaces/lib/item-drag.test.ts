import { describe, expect, it } from "vitest";
import { hasItemDrag, ITEM_DRAG_TYPE, readDraggedItem, writeDraggedItem } from "./item-drag";

const ID = "4f1c2d3e-0000-4000-8000-000000000001";

function fakeTransfer() {
  const data = new Map<string, string>();
  return {
    types: [] as string[],
    effectAllowed: "none",
    setData(type: string, value: string) {
      data.set(type, value);
      this.types = [...data.keys()];
    },
    getData: (type: string) => data.get(type) ?? "",
  };
}

describe("arrastar item para outro espaço", () => {
  it("o que sai da linha é lido de volta no espaço da barra lateral", () => {
    const transfer = fakeTransfer();
    writeDraggedItem(transfer, { id: ID, title: "Reunião — 30/09" });
    expect(transfer.effectAllowed).toBe("move");
    expect(hasItemDrag(transfer)).toBe(true);
    expect(readDraggedItem(transfer)).toEqual({ id: ID, title: "Reunião — 30/09" });
  });

  it("link, arquivo ou texto arrastados de fora não contam como item", () => {
    expect(hasItemDrag({ types: ["text/uri-list", "Files"] })).toBe(false);
    expect(hasItemDrag(null)).toBe(false);
    expect(readDraggedItem(fakeTransfer())).toBeNull();
  });

  it("conteúdo estragado ou com id inválido é recusado", () => {
    const bad = fakeTransfer();
    bad.setData(ITEM_DRAG_TYPE, "{não é json");
    expect(readDraggedItem(bad)).toBeNull();
    const noId = fakeTransfer();
    noId.setData(ITEM_DRAG_TYPE, JSON.stringify({ id: "../../x", title: "a" }));
    expect(readDraggedItem(noId)).toBeNull();
  });
});
