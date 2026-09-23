"use client";

import type { SidebarSpace } from "@/features/spaces/queries";
import type { TypeOptionWithFields } from "@/features/items/queries";
import type { AskScope } from "@/features/ai/lib/retrieve";

const inputClassName = "rounded-full border border-black/[.12] bg-transparent px-3 py-1 text-xs dark:border-white/[.16]";

interface AskScopePickerProps {
  spaces: SidebarSpace[];
  types: TypeOptionWithFields[];
  scope: AskScope;
  onChange: (scope: AskScope) => void;
  disabled: boolean;
}

/**
 * "Escopo escolhido" (6.7, passo 1) — simplificado pra um espaço/tipo por vez
 * (a página é de uso pessoal e só precisa restringir, não combinar vários;
 * ver `docs/decisoes.md`), mais período. Trava depois da primeira pergunta
 * (`disabled`) — a conversa já foi criada com esse escopo (`getOrCreateConversation`).
 */
export function AskScopePicker({ spaces, types, scope, onChange, disabled }: AskScopePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Espaço"
        disabled={disabled}
        value={scope.spaceIds?.[0] ?? ""}
        onChange={(e) => onChange({ ...scope, spaceIds: e.target.value ? [e.target.value] : undefined })}
        className={inputClassName}
      >
        <option value="">Todos os espaços</option>
        {spaces.map((space) => (
          <option key={space.id} value={space.id}>
            {space.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Tipo"
        disabled={disabled}
        value={scope.typeIds?.[0] ?? ""}
        onChange={(e) => onChange({ ...scope, typeIds: e.target.value ? [e.target.value] : undefined })}
        className={inputClassName}
      >
        <option value="">Todos os tipos</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        aria-label="De"
        disabled={disabled}
        value={scope.dateFrom ?? ""}
        onChange={(e) => onChange({ ...scope, dateFrom: e.target.value || undefined })}
        className={inputClassName}
      />
      <input
        type="date"
        aria-label="Até"
        disabled={disabled}
        value={scope.dateTo ?? ""}
        onChange={(e) => onChange({ ...scope, dateTo: e.target.value || undefined })}
        className={inputClassName}
      />
    </div>
  );
}
