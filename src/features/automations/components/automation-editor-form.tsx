"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilterBar } from "@/features/views/components/filter-bar";
import type { ViewFilter } from "@/features/views/schemas";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createAutomation, updateAutomation } from "../actions";
import type { AutomationInput, AutomationAction, AutomationTrigger } from "../schemas";
import type { TypeWithFields } from "../queries";
import { ActionFields } from "./action-fields";
import { TriggerFields } from "./trigger-fields";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

interface Props {
  automationId?: string;
  initial: {
    name: string;
    description: string | null;
    enabled: boolean;
    spaceId: string | null;
    typeId: string | null;
    trigger: AutomationTrigger;
    conditions: ViewFilter[];
    actions: AutomationAction[];
  };
  spaces: SidebarSpace[];
  types: TypeWithFields[];
}

/** Editor "Quando [gatilho] Se [condições] Então [ações]" (5.3). */
export function AutomationEditorForm({ automationId, initial, spaces, types }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [spaceId, setSpaceId] = useState(initial.spaceId ?? "");
  const [typeId, setTypeId] = useState(initial.typeId ?? "");
  const [trigger, setTrigger] = useState<AutomationTrigger>(initial.trigger);
  const [conditions, setConditions] = useState<ViewFilter[]>(initial.conditions);
  const [actions, setActions] = useState<AutomationAction[]>(initial.actions);

  const selectedType = types.find((type) => type.id === typeId);
  const fields = selectedType?.fields ?? [];

  function updateAction(index: number, action: AutomationAction) {
    setActions((prev) => prev.map((a, i) => (i === index ? action : a)));
  }
  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }
  function addAction() {
    setActions((prev) => [...prev, { type: "notify_me", title: "", body: "" }]);
  }

  function handleSubmit() {
    setError(null);
    const input: AutomationInput = {
      name,
      description: description || undefined,
      enabled,
      spaceId: spaceId || null,
      typeId: typeId || null,
      trigger,
      conditions,
      actions,
    };

    startTransition(async () => {
      if (automationId) {
        const result = await updateAutomation(automationId, input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
        return;
      }

      const result = await createAutomation(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/configuracoes/automacoes/${result.data.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <input placeholder="Nome da automação" value={name} onChange={(event) => setName(event.target.value)} className={`${inputClassName} min-w-0 flex-1`} />
        <label className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-200">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Ativa
        </label>
      </div>
      <textarea
        placeholder="Descrição (opcional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className={`${inputClassName} min-h-14`}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <span>Aplica-se ao tipo</span>
        <select value={typeId} onChange={(event) => setTypeId(event.target.value)} className={inputClassName}>
          <option value="">Qualquer tipo</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        <span>no espaço</span>
        <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className={inputClassName}>
          <option value="">Qualquer espaço</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </div>

      <TriggerFields trigger={trigger} fields={fields} onChange={setTrigger} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-black dark:text-zinc-50">Se (opcional)</span>
        <FilterBar filters={conditions} fields={fields} onChange={setConditions} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-black dark:text-zinc-50">Então</span>
        {actions.map((action, index) => (
          <ActionFields key={index} action={action} fields={fields} types={types} spaces={spaces} onChange={(next) => updateAction(index, next)} onRemove={() => removeAction(index)} />
        ))}
        <button type="button" onClick={addAction} className="self-start text-sm text-zinc-500 underline dark:text-zinc-400">
          Adicionar ação
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="bg-foreground text-background self-start rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
