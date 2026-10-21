import type { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { getActiveEditor, insertImageInActiveEditor, registerActiveEditor } from "./active-editor";

function fakeEditor(destroyed = false, docSize = 100) {
  const setImage = vi.fn(() => ({ run: vi.fn() }));
  const insertContentAt = vi.fn(() => ({ run: vi.fn() }));
  const editor = {
    isDestroyed: destroyed,
    state: { doc: { content: { size: docSize } } },
    chain: () => ({ focus: () => ({ setImage, insertContentAt }) }),
  } as unknown as Editor;
  return { editor, setImage, insertContentAt };
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

  it("no editor recriado, insere na posição em que a pessoa colou (e nunca além do fim)", async () => {
    const fresh = fakeEditor(false, 40);
    registerActiveEditor("item-3", fresh.editor);
    expect(await insertImageInActiveEditor("item-3", image, { position: 25 })).toBe(true);
    expect(fresh.insertContentAt).toHaveBeenCalledWith(25, { type: "image", attrs: image });
    expect(fresh.setImage).not.toHaveBeenCalled();

    await insertImageInActiveEditor("item-3", image, { position: 999 });
    expect(fresh.insertContentAt).toHaveBeenLastCalledWith(40, { type: "image", attrs: image });
  });
});
