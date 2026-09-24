import JSZip from "jszip";

export interface ZipTextEntry {
  path: string;
  content: string;
}

/** Lê todo `.zip` como texto UTF-8 (o suficiente pra Obsidian ".md" e Google Takeout ".json") — pastas e o próprio `__MACOSX/`/`.DS_Store` (zips feitos no Mac) são ignorados. */
export async function readZipAsText(buffer: ArrayBuffer): Promise<ZipTextEntry[]> {
  const zip = await JSZip.loadAsync(buffer);
  const entries: ZipTextEntry[] = [];

  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (path.startsWith("__MACOSX/") || path.split("/").pop() === ".DS_Store") continue;
    entries.push({ path, content: await file.async("text") });
  }

  return entries;
}
