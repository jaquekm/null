/**
 * Resolve `typeRef` → `typeId` em qualquer profundidade de um valor JSON
 * (trigger/conditions/actions de automações, config de regra de lembrete).
 * Usado pelo instalador (5.2) — o formato detalhado de cada gatilho/ação
 * pertence à 5.3, aqui só precisamos trocar a referência pelo id real.
 */
export function resolveTypeRefs<T>(value: T, typeIdByRef: Record<string, string>): T {
  if (Array.isArray(value)) {
    return value.map((item) => resolveTypeRefs(item, typeIdByRef)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === "typeRef" && typeof val === "string") {
        out.typeId = typeIdByRef[val] ?? null;
        continue;
      }
      out[key] = resolveTypeRefs(val, typeIdByRef);
    }
    return out as T;
  }
  return value;
}

/**
 * Mesma ideia de `resolveTypeRefs`, pra `spaceRef` → `spaceId` (5.11: ação
 * `move_to_space` de uma automação mirando um espaço criado pelo próprio
 * pack, ex. "Arquivo" do método PARA).
 */
export function resolveSpaceRefs<T>(value: T, spaceIdByRef: Record<string, string>): T {
  if (Array.isArray(value)) {
    return value.map((item) => resolveSpaceRefs(item, spaceIdByRef)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === "spaceRef" && typeof val === "string") {
        out.spaceId = spaceIdByRef[val] ?? null;
        continue;
      }
      out[key] = resolveSpaceRefs(val, spaceIdByRef);
    }
    return out as T;
  }
  return value;
}

/**
 * Inverso de `resolveTypeRefs` — usado pela exportação (5.2, "Exportar como
 * pack"): troca `typeId` por `typeRef` quando o id pertence à seleção
 * exportada; ids fora da seleção ficam como estão (referência externa).
 */
export function invertTypeRefs<T>(value: T, refByTypeId: Record<string, string>): T {
  if (Array.isArray(value)) {
    return value.map((item) => invertTypeRefs(item, refByTypeId)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === "typeId" && typeof val === "string" && refByTypeId[val]) {
        out.typeRef = refByTypeId[val];
        continue;
      }
      out[key] = invertTypeRefs(val, refByTypeId);
    }
    return out as T;
  }
  return value;
}
