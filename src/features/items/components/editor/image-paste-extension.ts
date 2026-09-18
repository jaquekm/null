import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { uploadAttachment } from "@/features/attachments/lib/upload-file";

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
                  editor.chain().focus().setImage({ src: `/api/attachments/${result.data.attachment.id}/file`, alt: file.name }).run();
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
