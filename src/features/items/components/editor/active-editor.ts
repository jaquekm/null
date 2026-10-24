import type { Editor } from "@tiptap/core";

/**
 * Editor vivo de cada item (07/10). A página do item recria o editor (`key={item.updatedAt}`)
 * sempre que o servidor devolve um `updatedAt` novo — por exemplo quando o envio de um anexo
 * revalida a página. Quem termina um trabalho assíncrono (colar imagem: enviar o arquivo e só
 * depois inserir) não pode segurar o editor de antes, que já foi descartado: pergunta aqui
 * qual é o editor de agora.
 */
const editors = new Map<string, Editor>();

export function registerActiveEditor(itemId: string, editor: Editor): () => void {
  editors.set(itemId, editor);
  return () => {
    // Só sai se ainda for o mesmo: o editor novo pode já ter se registrado.
    if (editors.get(itemId) === editor) editors.delete(itemId);
  };
}

export function getActiveEditor(itemId: string): Editor | null {
  const editor = editors.get(itemId);
  return editor && !editor.isDestroyed ? editor : null;
}

/**
 * Insere a imagem no editor atual do item. Se a página estiver recriando o editor
 * agora (sem editor vivo por um instante), espera um pouco e tenta de novo.
 * `position` é onde o cursor estava quando a pessoa colou: o editor novo começa sem
 * cursor, e sem isso a imagem iria parar no começo ou no fim do texto, não onde foi colada.
 * Devolve `true` se inseriu.
 */
export async function insertImageInActiveEditor(
  itemId: string,
  image: { src: string; alt: string },
  { tries = 15, delayMs = 200, position }: { tries?: number; delayMs?: number; position?: number } = {},
): Promise<boolean> {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const editor = getActiveEditor(itemId);
    if (editor) {
      if (position === undefined) {
        editor.chain().focus().setImage(image).run();
      } else {
        // O texto pode ter encurtado desde a colagem: nunca passa do fim do documento.
        const at = Math.max(0, Math.min(position, editor.state.doc.content.size));
        editor.chain().focus().insertContentAt(at, { type: "image", attrs: image }).run();
      }
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}
