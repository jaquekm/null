export interface JSONContentNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContentNode[];
  [key: string]: unknown;
}

function parsePath(path: string): number[] | null {
  if (!/^\d+(\.\d+)*$/.test(path)) return null;
  return path.split(".").map(Number);
}

/**
 * Marca cada nó `taskItem` do documento com o caminho até ele (`attrs.path`,
 * ex.: `"0.2.1"` — índices dos filhos, raiz até o nó) — permissão `check`
 * (3.11): é como o checkbox clicável na página pública sabe qual nó do JSON
 * avisar de volta pro servidor, sem precisar de um id estável salvo no
 * conteúdo (o editor normal não tem — não dá pra mudar o schema por causa
 * só do compartilhamento).
 */
export function injectTaskItemPaths(node: JSONContentNode, path: number[] = []): JSONContentNode {
  const isTaskItem = node.type === "taskItem";
  const content = node.content?.map((child, index) => injectTaskItemPaths(child, [...path, index]));

  return {
    ...node,
    ...(content ? { content } : {}),
    ...(isTaskItem ? { attrs: { ...(node.attrs ?? {}), path: path.join(".") } } : {}),
  };
}

/**
 * Marca (ou desmarca) o `taskItem` em `path` — permissão `check`: a
 * server action que recebe o clique do visitante anônimo chama isso e
 * salva o resultado como o novo `content` do item. `null` se o caminho
 * não existir mais (conteúdo mudou desde que a página foi carregada) ou
 * não apontar pra um `taskItem` — quem chama trata como "não fez nada".
 */
export function toggleTaskAtPath(content: JSONContentNode, path: string, checked: boolean): JSONContentNode | null {
  const indices = parsePath(path);
  if (!indices) return null;

  function walk(node: JSONContentNode, remaining: number[]): JSONContentNode | null {
    if (remaining.length === 0) {
      if (node.type !== "taskItem") return null;
      return { ...node, attrs: { ...(node.attrs ?? {}), checked } };
    }

    const [head, ...rest] = remaining as [number, ...number[]];
    const children = node.content;
    if (!children || head >= children.length) return null;

    const updatedChild = walk(children[head]!, rest);
    if (!updatedChild) return null;

    const newChildren = [...children];
    newChildren[head] = updatedChild;
    return { ...node, content: newChildren };
  }

  return walk(content, indices);
}

/**
 * Texto do `taskItem` em `path` (só o próprio item, sem sub-itens) — pro
 * aviso "Marcaram “Leite” em Compras" (9.7). `null` se o caminho não
 * aponta pra um `taskItem`.
 */
export function taskTextAtPath(content: JSONContentNode, path: string): string | null {
  const indices = parsePath(path);
  if (!indices) return null;
  let node: JSONContentNode | undefined = content;
  for (const index of indices) node = node?.content?.[index];
  if (!node || node.type !== "taskItem") return null;

  const own = (node.content ?? []).filter((child) => child.type !== "taskList" && child.type !== "bulletList" && child.type !== "orderedList");
  const parts: string[] = [];
  const collect = (child: JSONContentNode) => {
    if (typeof child.text === "string") parts.push(child.text);
    child.content?.forEach(collect);
  };
  own.forEach(collect);
  const text = parts.join("").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 200) : null;
}
