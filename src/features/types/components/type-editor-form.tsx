"use client";

import { useActionState } from "react";
import type { Result } from "@/lib/result";
import { ColorPicker } from "@/components/shared/color-picker";
import type { SidebarSpace } from "@/features/spaces/queries";
import { updateObjectType } from "../actions";
import { viewKinds } from "../object-type-schemas";
import type { ObjectTypeDetail } from "../queries";

const VIEW_KIND_LABELS: Record<(typeof viewKinds)[number], string> = {
  list: "Lista",
  table: "Tabela",
  kanban: "Kanban",
  calendar: "Calendário",
  gallery: "Galeria",
  timeline: "Linha do tempo",
};

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

const initialState: Result<null> = { ok: true, data: null };

export function TypeEditorForm({ type, spaces }: { type: ObjectTypeDetail; spaces: SidebarSpace[] }) {
  const action = updateObjectType.bind(null, type.id);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input name="icon" defaultValue={type.icon ?? ""} aria-label="Ícone" maxLength={4} className={`${inputClassName} w-14 text-center`} />
        <input
          name="name"
          defaultValue={type.name}
          aria-label="Nome"
          required
          maxLength={80}
          className={`${inputClassName} min-w-0 flex-1`}
        />
        <input
          name="pluralName"
          defaultValue={type.pluralName ?? ""}
          aria-label="Nome no plural"
          placeholder="Plural"
          maxLength={80}
          className={`${inputClassName} w-32`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select name="spaceId" defaultValue={type.spaceId ?? ""} aria-label="Espaço" className={inputClassName}>
          <option value="">Todos os espaços</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.icon ? `${space.icon} ` : ""}
              {space.name}
            </option>
          ))}
        </select>

        <select name="defaultView" defaultValue={type.defaultView} aria-label="Visão padrão" className={inputClassName}>
          {viewKinds.map((kind) => (
            <option key={kind} value={kind}>
              {VIEW_KIND_LABELS[kind]}
            </option>
          ))}
        </select>

        <input
          name="titleTemplate"
          defaultValue={type.titleTemplate ?? ""}
          placeholder="Template de título (ex.: Reunião {{date}})"
          maxLength={200}
          className={`${inputClassName} min-w-0 flex-1`}
        />
      </div>

      <ColorPicker name="color" defaultValue={type.color} aria-label="Cor do tipo" />

      {!state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background self-start rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
