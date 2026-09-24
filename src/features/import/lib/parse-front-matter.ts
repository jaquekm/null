export interface ParsedFrontMatter {
  data: Record<string, string | string[]>;
  body: string;
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Front matter YAML "achatado" — só o subconjunto que notas de verdade usam
 * (`key: valor`, lista inline `[a, b]`, lista em bloco `- item`). Sem
 * dependência de YAML (nenhuma no projeto) — suficiente pra Obsidian/Notion,
 * que nunca aninham objeto dentro de front matter de nota.
 */
export function parseFrontMatter(content: string): ParsedFrontMatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!match) return { data: {}, body: content };

  const yamlBlock = match[1]!;
  const body = content.slice(match[0].length);
  const data: Record<string, string | string[]> = {};

  let currentListKey: string | null = null;
  for (const rawLine of yamlBlock.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, "  ");

    if (currentListKey && /^\s+-\s+/.test(line)) {
      const value = unquote(line.replace(/^\s+-\s+/, "").trim());
      const list = data[currentListKey];
      if (Array.isArray(list)) list.push(value);
      continue;
    }
    currentListKey = null;

    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1]!;
    const rawValue = kv[2]!.trim();

    if (rawValue === "") {
      data[key] = [];
      currentListKey = key;
    } else if (/^\[.*\]$/.test(rawValue)) {
      data[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((v) => unquote(v.trim()))
        .filter(Boolean);
    } else {
      data[key] = unquote(rawValue);
    }
  }

  return { data, body };
}
