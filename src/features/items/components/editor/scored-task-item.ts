import TaskItem from "@tiptap/extension-task-item";

/**
 * `taskItem` com nota de 1 a 5 (tipo de lista "Dar nota"). Sem o atributo
 * declarado aqui, o editor completo descartaria a nota ao salvar o documento.
 */
export const ScoredTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      score: {
        default: null,
        keepOnSplit: false,
        parseHTML: (element: HTMLElement) => {
          const value = Number(element.getAttribute("data-score"));
          return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
        },
        renderHTML: (attributes: { score?: number | null }) => (attributes.score ? { "data-score": String(attributes.score) } : {}),
      },
    };
  },
});
