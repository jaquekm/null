import type { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { getActiveEditor, insertImageInActiveEditor, registerActiveEditor } from "./active-editor";

function fakeEditor(destroyed = false) {
  const setImage = vi.fn(() => ({ run: vi.fn() }));
  const editor = { isDestroyed: destroyed, chain: () => ({ focus: () => ({ setImage }) }) } as unknown as Editor;
  return { editor, setImage };
}

const image = { src: "/api/attachments/a1/file", alt: "print.png" };

describe("editor ativo do item (imagem colada não some quando a página recria o editor)", () => {
  it("insere a imagem no editor de agora, não no que foi descartado", async () => {
    const old = fakeEditor();
    const unregisterOld = registerActiveEditor("item-1", old.editor);
    // a página recria o editor: o antigo é descartado, o novo se registra
    (old.editor as unknown as { isDestroyed: boolean }).isDestroyed = true;
    const fresh = fakeEditor();
    registerActiveEditor("item-1", fresh.editor);
    unregisterOld(); // o antigo saindo não derruba o novo

    expect(getActiveEditor("item-1")).toBe(fresh.editor);
    expect(await insertImageInActiveEditor("item-1", image)).toBe(true);
    expect(fresh.setImage).toHaveBeenCalledWith(image);
    expect(old.setImage).not.toHaveBeenCalled();
  });

  it("espera o editor novo aparecer quando a página está recriando", async () => {
    vi.useFakeTimers();
    const gone = fakeEditor(true);
    registerActiveEditor("item-2", gone.editor);
    const pending = insertImageInActiveEditor("item-2", image, { tries: 5, delayMs: 100 });
    await vi.advanceTimersByTimeAsync(150);
    const fresh = fakeEditor();
    registerActiveEditor("item-2", fresh.editor);
    await vi.advanceTimersByTimeAsync(150);
    expect(await pending).toBe(true);
    expect(fresh.setImage).toHaveBeenCalledWith(image);
    vi.useRealTimers();
  });

  it("desiste depois das tentativas se nunca houver editor", async () => {
    vi.useFakeTimers();
    const pending = insertImageInActiveEditor("item-sem-editor", image, { tries: 3, delayMs: 50 });
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toBe(false);
    vi.useRealTimers();
  });
});
