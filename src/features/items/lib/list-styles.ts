import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import { splitLinks } from "@/lib/linkify";

/**
 * Tipos de lista (pedido da dona): o tipo diz **como a lista se comporta**,
 * não o assunto — o assunto/grupo é o espaço onde a lista mora. Todos operam
 * sobre os mesmos `taskItem` do documento, então dá pra trocar de tipo a
 * qualquer momento sem perder nada (marcado continua marcado, nota continua
 * guardada no item).
 */
export const listStyles = ["checklist", "multi", "single", "rating", "priority"] as const;
export type ListStyle = (typeof listStyles)[number];
export const listStyleSchema = z.enum(listStyles);

export const LIST_STYLE_INFO: Record<ListStyle, { label: string; description: string }> = {
  checklist: { label: "Riscar", description: "Toque para riscar o que já foi feito. Os riscados descem para o fim." },
  multi: { label: "Marcar vários", description: "Toque para marcar quantos quiser. Nada é riscado nem sai do lugar." },
  single: { label: "Escolher um", description: "Toque para escolher uma opção. Escolher outra troca a escolha." },
  rating: { label: "Dar nota", description: "Dê de 1 a 5 estrelas para cada item. A lista fica do mais bem avaliado para o menos." },
  priority: { label: "Ordenar e agrupar", description: "Suba e desça os itens para ordenar por prioridade e separe em grupos." },
};

/** Tipo salvo no item; lista antiga (sem tipo) funciona como "Riscar", o comportamento de antes. */
export function listStyleOf(properties: Record<string, unknown> | null | undefined): ListStyle {
  const parsed = listStyleSchema.safeParse(properties?.list_style);
  return parsed.success ? parsed.data : "checklist";
}

export interface ListEntry {
  /** Posição do `taskItem` na ordem do documento, contando aninhados — a mesma de `flattenChecklist`. */
  index: number;
  /** A linha do item (o primeiro parágrafo). */
  text: string;
  checked: boolean;
  score: number | null;
  /**
   * Detalhes do item (pedido da dona, 07/10): link, endereço, valores… — os
   * parágrafos que vêm depois da linha, dentro do próprio `taskItem`. Assim
   * aparecem também no editor completo (recuados embaixo do item) e no link
   * compartilhado, sem campo novo. Uma linha por parágrafo; "" = sem detalhes.
   */
  details: string;
}

export interface ListSection {
  /** Texto do título que abre o grupo; `null` para os itens antes do primeiro título. */
  title: string | null;
  /** Só os itens de primeiro nível — os aninhados andam junto com o item pai. */
  entries: ListEntry[];
}

function textOf(node: JSONContent): string {
  let text = "";
  function walk(n: JSONContent) {
    if (typeof n.text === "string") text += n.text;
    if (n.type === "taskList") return;
    for (const child of n.content ?? []) walk(child);
  }
  for (const child of node.content ?? []) walk(child);
  return text;
}

function scoreOf(node: JSONContent): number | null {
  const score = node.attrs?.score;
  return typeof score === "number" && score >= 1 && score <= 5 ? score : null;
}

function inlineText(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(inlineText).join("");
}

/** Blocos do `taskItem` que não são a linha nem uma sublista (os detalhes). */
function detailBlocks(node: JSONContent): JSONContent[] {
  const [, ...rest] = node.content ?? [];
  return rest.filter((child) => child.type !== "taskList");
}

function entryOf(node: JSONContent, index: number): ListEntry {
  const first = node.content?.[0];
  const text = first && first.type !== "taskList" ? inlineText(first).replace(/\n/g, " ") : "";
  const details = detailBlocks(node)
    .map((block) => inlineText(block).trimEnd())
    .join("\n")
    .trim();
  return { index, text, checked: node.attrs?.checked === true, score: scoreOf(node), details };
}

/** Texto com os links marcados (clicáveis no editor e no link compartilhado). */
function lineWithLinks(line: string): JSONContent[] {
  return splitLinks(line).map((part) =>
    part.href ? { type: "text", text: part.text, marks: [{ type: "link", attrs: { href: part.href } }] } : { type: "text", text: part.text },
  );
}

/**
 * Grava os detalhes de um item: cada linha vira um parágrafo logo depois da
 * linha do item (substitui os detalhes anteriores); sublistas continuam no lugar.
 */
export function setItemDetails(doc: JSONContent, index: number, details: string): JSONContent {
  const lines = details
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
  const paragraphs: JSONContent[] = lines
    ? lines.split("\n").map((line) => (line ? { type: "paragraph", content: lineWithLinks(line) } : { type: "paragraph" }))
    : [];
  return mapTaskItems(doc, (node, i) => {
    if (i !== index) return node;
    const children = node.content ?? [];
    const first = children[0] && children[0].type !== "taskList" ? children[0] : { type: "paragraph" };
    const sublists = children.filter((child) => child.type === "taskList");
    return { ...node, content: [first, ...paragraphs, ...sublists] };
  });
}

/** Troca o nome (a linha) de um item, sem mexer em detalhes, nota, marcação nem sublistas. Nome vazio é recusado (devolve o documento igual). */
export function setItemText(doc: JSONContent, index: number, text: string): JSONContent {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return doc;
  return mapTaskItems(doc, (node, i) => {
    if (i !== index) return node;
    const children = node.content ?? [];
    const rest = children[0] && children[0].type !== "taskList" ? children.slice(1) : children;
    return { ...node, content: [{ type: "paragraph", content: lineWithLinks(value) }, ...rest] };
  });
}

/**
 * Exclui um item da lista (com os detalhes e as sublistas dele). Lista que
 * fica vazia sai do documento — o editor não aceita `taskList` sem itens.
 */
export function removeListItem(doc: JSONContent, index: number): JSONContent {
  let seen = -1;
  function walk(node: JSONContent): JSONContent | null {
    if (node.type === "taskItem") {
      seen += 1;
      if (seen === index) {
        // Os aninhados contam na numeração: pula a contagem deles também.
        seen += countTaskItems(node) - 1;
        return null;
      }
    }
    if (!node.content) return node;
    const content = node.content.map(walk).filter((child): child is JSONContent => child !== null);
    if (node.type === "taskList" && content.length === 0) return null;
    return { ...node, content };
  }
  return walk(doc) ?? { type: "doc", content: [] };
}

function countTaskItems(node: JSONContent): number {
  return (node.type === "taskItem" ? 1 : 0) + (node.content ?? []).reduce((sum, child) => sum + countTaskItems(child), 0);
}

/** Todos os itens, inclusive aninhados, na ordem do documento (com a nota de cada um). */
export function listEntries(doc: JSONContent | null): ListEntry[] {
  if (!doc) return [];
  const entries: ListEntry[] = [];
  function walk(node: JSONContent) {
    if (node.type === "taskItem") entries.push(entryOf(node, entries.length));
    for (const child of node.content ?? []) walk(child);
  }
  walk(doc);
  return entries;
}

/** Passa cada `taskItem` (com sua posição na ordem de `listEntries`) por `fn`. */
function mapTaskItems(doc: JSONContent, fn: (node: JSONContent, index: number) => JSONContent): JSONContent {
  let seen = -1;
  function walk(node: JSONContent): JSONContent {
    let next = node;
    if (node.type === "taskItem") {
      seen += 1;
      next = fn(node, seen);
    }
    if (next.content) return { ...next, content: next.content.map(walk) };
    return next;
  }
  return walk(doc);
}

/** "Escolher um": marca só o item tocado; tocar de novo na escolha desfaz. */
export function chooseOnly(doc: JSONContent, index: number): JSONContent {
  const current = listEntries(doc)[index];
  const choose = current ? !current.checked : false;
  return mapTaskItems(doc, (node, i) => ({ ...node, attrs: { ...node.attrs, checked: i === index ? choose : false } }));
}

/** "Dar nota": 1 a 5; `null` apaga a nota. */
export function setItemScore(doc: JSONContent, index: number, score: number | null): JSONContent {
  const value = score !== null && Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
  return mapTaskItems(doc, (node, i) => (i === index ? { ...node, attrs: { ...node.attrs, score: value } } : node));
}

/** Com nota primeiro (maior para menor); empate e sem nota mantêm a ordem da lista. */
export function sortByScore(entries: ListEntry[]): ListEntry[] {
  return [...entries].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.index - b.index);
}

// ---------------------------------------------------------------------------
// "Ordenar e agrupar": grupos são os títulos do documento; cada grupo junta
// os itens de primeiro nível das listas de tarefa que vêm depois dele.
// ---------------------------------------------------------------------------

interface SectionRange {
  title: string | null;
  /** Índice (em `doc.content`) do título — `-1` no grupo inicial, sem título. */
  headingAt: number;
  /** Fim exclusivo do grupo em `doc.content`. */
  end: number;
}

interface Location {
  section: number;
  list: JSONContent;
  node: JSONContent;
  index: number;
}

function sectionRanges(content: JSONContent[]): SectionRange[] {
  const ranges: SectionRange[] = [{ title: null, headingAt: -1, end: content.length }];
  content.forEach((node, i) => {
    if (node.type !== "heading") return;
    const previous = ranges[ranges.length - 1];
    if (previous) previous.end = i;
    ranges.push({ title: textOf(node).trim() || "Sem título", headingAt: i, end: content.length });
  });
  return ranges;
}

function scan(doc: JSONContent): { ranges: SectionRange[]; locations: Location[] } {
  const content = doc.content ?? [];
  const ranges = sectionRanges(content);
  const locations: Location[] = [];
  let seen = 0;
  function count(node: JSONContent) {
    if (node.type === "taskItem") seen += 1;
    for (const child of node.content ?? []) count(child);
  }
  content.forEach((block, i) => {
    const section = ranges.findIndex((r) => i > r.headingAt && i < r.end);
    if (block.type === "taskList" && section !== -1) {
      for (const item of block.content ?? []) {
        if (item.type === "taskItem") locations.push({ section, list: block, node: item, index: seen });
        count(item);
      }
    } else {
      count(block);
    }
  });
  return { ranges, locations };
}

/** Grupos na ordem do documento; o grupo inicial sem título só aparece se tiver itens ou se não houver nenhum título. */
export function listSections(doc: JSONContent | null): ListSection[] {
  if (!doc) return [{ title: null, entries: [] }];
  const { ranges, locations } = scan(doc);
  const sections = ranges.map((range, i) => ({
    title: range.title,
    entries: locations.filter((l) => l.section === i).map((l) => entryOf(l.node, l.index)),
  }));
  if (sections.length > 1 && sections[0]?.entries.length === 0) sections.shift();
  return sections;
}

/** Índice de grupo como `listSections` mostra → índice interno (que sempre tem o grupo inicial). */
function rangeIndex(doc: JSONContent, shownSection: number): number {
  const { ranges, locations } = scan(doc);
  const hidesLeading = ranges.length > 1 && !locations.some((l) => l.section === 0);
  return hidesLeading ? shownSection + 1 : shownSection;
}

function newList(): JSONContent {
  return { type: "taskList", content: [] };
}

/** Coloca `node` no começo ou no fim do grupo, criando uma lista de tarefas se o grupo ainda não tem. */
function insertInSection(content: JSONContent[], range: SectionRange, node: JSONContent, where: "start" | "end") {
  const lists = content.slice(range.headingAt + 1, range.end).filter((b) => b.type === "taskList");
  const existing = where === "start" ? lists[0] : lists[lists.length - 1];
  if (existing) {
    existing.content = where === "start" ? [node, ...(existing.content ?? [])] : [...(existing.content ?? []), node];
    return;
  }
  const list = newList();
  list.content = [node];
  content.splice(where === "start" ? range.headingAt + 1 : range.end, 0, list);
}

function removeNode(list: JSONContent, node: JSONContent) {
  list.content = (list.content ?? []).filter((n) => n !== node);
}

/** Lista de tarefas que ficou vazia é inválida no editor (`taskItem+`) — sai do documento. */
function dropEmptyLists(content: JSONContent[]): JSONContent[] {
  return content.filter((b) => b.type !== "taskList" || (b.content ?? []).length > 0);
}

/**
 * Sobe ou desce um item uma posição. No topo (ou no fim) do grupo, passa para
 * o fim do grupo anterior (ou começo do próximo) — é assim que um item muda
 * de grupo só com as setas.
 */
export function moveListItem(doc: JSONContent, index: number, direction: "up" | "down"): JSONContent {
  const copy = structuredClone(doc);
  const content = copy.content ?? [];
  const { ranges, locations } = scan(copy);
  const k = locations.findIndex((l) => l.index === index);
  const here = locations[k];
  if (!here) return doc;
  const neighbor = locations[direction === "up" ? k - 1 : k + 1];

  if (neighbor && neighbor.section === here.section) {
    removeNode(here.list, here.node);
    const at = (neighbor.list.content ?? []).indexOf(neighbor.node) + (direction === "up" ? 0 : 1);
    neighbor.list.content = [...(neighbor.list.content ?? [])];
    neighbor.list.content.splice(at, 0, here.node);
  } else {
    const targetAt = here.section + (direction === "up" ? -1 : 1);
    // O grupo inicial sem título fica escondido quando está vazio — subir do primeiro grupo visível não vai pra ele.
    const hidesLeading = ranges.length > 1 && !locations.some((l) => l.section === 0);
    const target = targetAt === 0 && hidesLeading ? undefined : ranges[targetAt];
    if (!target) return doc;
    removeNode(here.list, here.node);
    insertInSection(content, target, here.node, direction === "up" ? "end" : "start");
  }
  return { ...copy, content: dropEmptyLists(content) };
}

/** Manda o item para o fim de outro grupo (índice como em `listSections`). */
export function moveListItemToSection(doc: JSONContent, index: number, section: number): JSONContent {
  const copy = structuredClone(doc);
  const content = copy.content ?? [];
  const { ranges, locations } = scan(copy);
  const here = locations.find((l) => l.index === index);
  const target = ranges[rangeIndex(doc, section)];
  if (!here || !target) return doc;
  removeNode(here.list, here.node);
  insertInSection(content, target, here.node, "end");
  return { ...copy, content: dropEmptyLists(content) };
}

function taskItem(text: string): JSONContent {
  return { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] };
}

/** Novo item no fim do grupo (índice como em `listSections`). */
export function addItemToSection(doc: JSONContent | null, section: number, text: string): JSONContent {
  const copy: JSONContent = doc ? structuredClone(doc) : { type: "doc", content: [] };
  const content = copy.content ?? [];
  const ranges = sectionRanges(content);
  const target = ranges[doc ? rangeIndex(doc, section) : 0] ?? ranges[ranges.length - 1];
  if (!target) return copy;
  insertInSection(content, target, taskItem(text), "end");
  return { ...copy, content };
}

/** Novo grupo (título) no fim do documento; começa vazio. */
export function addSection(doc: JSONContent | null, title: string): JSONContent {
  const base: JSONContent = doc ?? { type: "doc", content: [] };
  const heading: JSONContent = { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: title }] };
  return { ...base, content: [...(base.content ?? []), heading] };
}

/**
 * "Dar nota" na página compartilhada: reordena cada lista de tarefas da maior
 * nota para a menor (sem nota no fim), como a dona vê no app. Os títulos e o
 * resto do documento ficam no lugar.
 */
export function sortTaskListsByScore(doc: JSONContent): JSONContent {
  function walk(node: JSONContent): JSONContent {
    const content = node.content?.map(walk);
    if (node.type !== "taskList" || !content) return content ? { ...node, content } : node;
    const ranked = content.map((child, i) => ({ child, i, score: child.type === "taskItem" ? (scoreOf(child) ?? 0) : 0 }));
    ranked.sort((a, b) => b.score - a.score || a.i - b.i);
    return { ...node, content: ranked.map((r) => r.child) };
  }
  return walk(doc);
}
