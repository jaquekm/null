import { z } from "zod";

export const CANVAS_NODE_KINDS = ["item", "text", "group", "image", "link", "contact"] as const;
export type CanvasNodeKind = (typeof CANVAS_NODE_KINDS)[number];

const jsonDataSchema = z.record(z.string(), z.unknown()).default({});

/** Um nó por tipo exige a referência (`itemId`/`contactId`/`attachmentId`) ou o campo de `data` que dá sentido a ele (5.5). */
export const createNodeSchema = z
  .object({
    canvasId: z.string().uuid(),
    kind: z.enum(CANVAS_NODE_KINDS),
    x: z.number(),
    y: z.number(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    parentNodeId: z.string().uuid().optional(),
    itemId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    attachmentId: z.string().uuid().optional(),
    data: jsonDataSchema,
  })
  .superRefine((input, ctx) => {
    if (input.kind === "item" && !input.itemId) {
      ctx.addIssue({ code: "custom", path: ["itemId"], message: "Nó de item precisa de um item." });
    }
    if (input.kind === "contact" && !input.contactId) {
      ctx.addIssue({ code: "custom", path: ["contactId"], message: "Nó de contato precisa de um contato." });
    }
    if (input.kind === "image" && !input.attachmentId) {
      ctx.addIssue({ code: "custom", path: ["attachmentId"], message: "Nó de imagem precisa de um anexo." });
    }
    if (input.kind === "text" && typeof input.data.text !== "string") {
      ctx.addIssue({ code: "custom", path: ["data", "text"], message: "Nó de texto precisa de `data.text`." });
    }
    if (input.kind === "link" && typeof input.data.url !== "string") {
      ctx.addIssue({ code: "custom", path: ["data", "url"], message: "Nó de link precisa de `data.url`." });
    }
  });
export type CreateNodeInput = z.infer<typeof createNodeSchema>;

/** Lote de posições (5.5, "salvar posição com debounce em lote") — um `UPDATE` por nó, mas uma chamada só. */
export const nodePositionUpdateSchema = z.array(z.object({ id: z.string().uuid(), x: z.number(), y: z.number() })).min(1);
export type NodePositionUpdate = z.infer<typeof nodePositionUpdateSchema>;

export const updateNodeSizeSchema = z.object({
  id: z.string().uuid(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const updateNodeDataSchema = z.object({ id: z.string().uuid(), data: z.record(z.string(), z.unknown()) });

export const updateNodeStyleSchema = z.object({ id: z.string().uuid(), style: z.record(z.string(), z.unknown()) });

export const setNodeParentSchema = z.object({ id: z.string().uuid(), parentNodeId: z.string().uuid().nullable() });

export const createEdgeSchema = z.object({
  canvasId: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  label: z.string().trim().max(120).optional(),
  createsLink: z.boolean().default(false),
});
export type CreateEdgeInput = z.infer<typeof createEdgeSchema>;

export const updateEdgeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().max(120).nullable().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

export const updateViewportSchema = z.object({
  canvasId: z.string().uuid(),
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});
export type UpdateViewportInput = z.infer<typeof updateViewportSchema>;
