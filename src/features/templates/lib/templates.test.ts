import { getSchema } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { listStyleSchema, listSections } from "@/features/items/lib/list-styles";
import { availableTemplates, findTemplate, ITEM_TEMPLATES, normalizeSubcategory, templateProperties } from "./templates";

const schema = getSchema([StarterKit, TaskList, TaskItem.configure({ nested: true })]);

describe("ITEM_TEMPLATES", () => {
  it("ids únicos e tipo de lista só em listas, sempre válido", () => {
    expect(new Set(ITEM_TEMPLATES.map((t) => t.id)).size).toBe(ITEM_TEMPLATES.length);
    for (const template of ITEM_TEMPLATES) {
      if (template.listStyle) {
        expect(template.typeSlug).toBe("lista");
        expect(listStyleSchema.safeParse(template.listStyle).success).toBe(true);
      }
    }
  });

  it("todo conteúdo inicial é um documento válido pro editor (senão o editor quebra ao abrir)", () => {
    for (const template of ITEM_TEMPLATES) {
      if (!template.content) continue;
      expect(() => schema.nodeFromJSON(template.content).check(), template.id).not.toThrow();
    }
  });

  it("Prioridades já nasce com os grupos", () => {
    const content = findTemplate("prioridades")?.content ?? null;
    expect(listSections(content).map((s) => s.title)).toEqual(["Saúde", "Família", "Trabalho"]);
  });
});

describe("availableTemplates", () => {
  it("esconde modelos cujo tipo não existe pra dona", () => {
    const ids = availableTemplates(["nota", "tarefa"]).map((t) => t.id);
    expect(ids).toEqual(["tarefa", "nota"]);
  });
});

describe("templateProperties", () => {
  it("junta as propriedades do modelo com o tipo de lista", () => {
    expect(templateProperties(findTemplate("lista-compras")!)).toEqual({ recurring: true, list_style: "checklist" });
    expect(templateProperties(findTemplate("nota")!)).toEqual({});
  });
});

describe("normalizeSubcategory", () => {
  it("minúsculas, espaços arrumados, vazio vira nulo", () => {
    expect(normalizeSubcategory("  Cunhada  Maria ")).toBe("cunhada maria");
    expect(normalizeSubcategory("   ")).toBeNull();
    expect(normalizeSubcategory(undefined)).toBeNull();
    expect(normalizeSubcategory("x".repeat(80))).toHaveLength(50);
  });
});
