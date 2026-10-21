import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { uploadAttachment } from "@/features/attachments/lib/upload-file";
import { getActiveEditor, insertImageInActiveEditor } from "./active-editor";

interface ImagePasteOptions {
  itemId: string;
}

/** "Colar imagem no editor" (1.7/1.9): envia o arquivo colado como anexo e insere inline. */
export const ImagePaste = Extension.create<ImagePasteOptions>({
  name: "imagePaste",

  addOptions() {
    return { itemId: "" };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const itemId = this.options.itemId;
    // O envio demora e a página pode recriar o editor nesse meio-tempo: insere no editor de agora, não no que colou.
    const insertImage = (image: { src: string; alt: string }) => {
      if (getActiveEditor(itemId) === null && !editor.isDestroyed) {
        editor.chain().focus().setImage(image).run();
        return;
      }
      void insertImageInActiveEditor(itemId, image);
    };

    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
            if (files.length === 0) return false;

            event.preventDefault();
            for (const file of files) {
              void uploadAttachment(itemId, file).then((result) => {
                if (result.ok && result.data) {
                  insertImage({ src: `/api/attachments/${result.data.attachment.id}/file`, alt: file.name });
                }
              });
            }
            return true;
          },
        },
      }),
    ];
  },
});
