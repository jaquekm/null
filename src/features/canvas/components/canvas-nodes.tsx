"use client";

import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { Link as LinkIcon, User } from "lucide-react";

export interface ItemNodeData extends Record<string, unknown> {
  itemId: string;
  title: string;
  icon: string | null;
  typeSlug: string | null;
}
export interface TextNodeData extends Record<string, unknown> {
  text: string;
  onChange?: (text: string) => void;
}
export interface GroupNodeData extends Record<string, unknown> {
  label: string;
  onChange?: (label: string) => void;
}
export interface ImageNodeData extends Record<string, unknown> {
  attachmentId: string;
}
export interface LinkNodeData extends Record<string, unknown> {
  url: string;
  title?: string;
}
export interface ContactNodeData extends Record<string, unknown> {
  contactId: string;
  name: string;
}

export type ItemFlowNode = Node<ItemNodeData, "item">;
export type TextFlowNode = Node<TextNodeData, "text">;
export type GroupFlowNode = Node<GroupNodeData, "group">;
export type ImageFlowNode = Node<ImageNodeData, "image">;
export type LinkFlowNode = Node<LinkNodeData, "link">;
export type ContactFlowNode = Node<ContactNodeData, "contact">;

export type CanvasFlowNode = ItemFlowNode | TextFlowNode | GroupFlowNode | ImageFlowNode | LinkFlowNode | ContactFlowNode;

const cardClassName =
  "flex min-w-40 max-w-64 flex-col gap-1 rounded-lg border bg-white p-3 text-sm shadow-sm dark:bg-zinc-900";

function ringClass(selected?: boolean) {
  return selected ? "border-black/40 dark:border-white/40" : "border-black/[.1] dark:border-white/[.12]";
}

function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2" />
    </>
  );
}

/** Nó "item" (5.5) — item real do banco; clique duplo abre o painel lateral (tratado no workspace). */
export function ItemNode({ data, selected }: NodeProps<ItemFlowNode>) {
  return (
    <div className={`${cardClassName} ${ringClass(selected)}`}>
      <NodeHandles />
      <div className="flex items-center gap-1.5 text-black dark:text-zinc-50">
        <span>{data.icon || "•"}</span>
        <span className="min-w-0 truncate font-medium">{data.title}</span>
      </div>
      {data.typeSlug && <span className="text-xs text-zinc-400 dark:text-zinc-500">{data.typeSlug}</span>}
    </div>
  );
}

/** Nó "texto" (5.5) — nota adesiva editável, salva ao perder o foco. */
export function TextNode({ data, selected }: NodeProps<TextFlowNode>) {
  return (
    <div
      className={`min-w-48 max-w-72 rounded-lg border p-3 text-sm shadow-sm ${
        selected ? "border-amber-400" : "border-amber-300/70"
      } bg-amber-50 dark:border-amber-400/40 dark:bg-amber-950/30`}
    >
      <NodeHandles />
      <textarea
        className="nodrag w-full resize-none bg-transparent text-zinc-800 outline-none dark:text-amber-100"
        rows={3}
        defaultValue={data.text}
        placeholder="Escreva algo…"
        onBlur={(e) => data.onChange?.(e.target.value)}
      />
    </div>
  );
}

/** Nó "grupo" (5.5) — moldura redimensionável que agrupa outros nós (`parent_node_id`). */
export function GroupNode({ data, selected }: NodeProps<GroupFlowNode>) {
  return (
    <div
      className={`h-full w-full rounded-lg border-2 border-dashed ${
        selected ? "border-black/40 dark:border-white/40" : "border-black/20 dark:border-white/20"
      } bg-black/[.02] dark:bg-white/[.02]`}
    >
      <NodeResizer isVisible={selected} minWidth={120} minHeight={80} />
      <input
        className="nodrag m-2 w-fit max-w-[80%] rounded bg-white/80 px-1.5 py-0.5 text-xs font-medium text-zinc-600 outline-none dark:bg-zinc-900/80 dark:text-zinc-300"
        defaultValue={data.label}
        onBlur={(e) => data.onChange?.(e.target.value)}
      />
    </div>
  );
}

/** Nó "imagem" (5.5) — anexo (2.x/1.9), servido pela rota estável que já existe pra anexos embutidos em itens. */
export function ImageNode({ data, selected }: NodeProps<ImageFlowNode>) {
  return (
    <div className={`overflow-hidden rounded-lg border bg-white dark:bg-zinc-900 ${ringClass(selected)}`}>
      <NodeHandles />
      {/* eslint-disable-next-line @next/next/no-img-element -- vem de rota própria (redireciona pra URL assinada), next/image não ajuda aqui */}
      <img src={`/api/attachments/${data.attachmentId}/file`} alt="" className="block h-40 w-56 object-cover" />
    </div>
  );
}

/** Nó "link" (5.5) — URL colada no canvas vazio. */
export function LinkNode({ data, selected }: NodeProps<LinkFlowNode>) {
  return (
    <div className={`${cardClassName} ${ringClass(selected)}`}>
      <NodeHandles />
      <div className="flex items-center gap-1.5 text-black dark:text-zinc-50">
        <LinkIcon className="h-4 w-4 shrink-0 text-zinc-400" />
        <span className="min-w-0 truncate font-medium">{data.title || data.url}</span>
      </div>
      <a href={data.url} target="_blank" rel="noopener noreferrer" className="nodrag truncate text-xs text-blue-600 underline dark:text-blue-400">
        {data.url}
      </a>
    </div>
  );
}

/** Nó "contato" (5.5) — cartão de contato. */
export function ContactNode({ data, selected }: NodeProps<ContactFlowNode>) {
  return (
    <div className={`${cardClassName} ${ringClass(selected)}`}>
      <NodeHandles />
      <div className="flex items-center gap-1.5 text-black dark:text-zinc-50">
        <User className="h-4 w-4 shrink-0 text-zinc-400" />
        <span className="min-w-0 truncate font-medium">{data.name}</span>
      </div>
    </div>
  );
}

export const canvasNodeTypes = {
  item: ItemNode,
  text: TextNode,
  group: GroupNode,
  image: ImageNode,
  link: LinkNode,
  contact: ContactNode,
};
