"use client";

import { useMemo, useState, useTransition } from "react";
import { exportPackAction } from "../actions";
import type { ExportableAutomation, ExportableType, ExportableView } from "../queries";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toggleId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

interface Props {
  types: ExportableType[];
  views: ExportableView[];
  automations: ExportableAutomation[];
}

/** Formulário de "Exportar como pack" (5.2, `/configuracoes/tipos`): seleciona tipos/visões/automações e baixa o JSON. */
export function ExportPackForm({ types, views, automations }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [typeIds, setTypeIds] = useState<Set<string>>(new Set());
  const [viewIds, setViewIds] = useState<Set<string>>(new Set());
  const [automationIds, setAutomationIds] = useState<Set<string>>(new Set());

  const availableViews = useMemo(() => views.filter((view) => view.typeId && typeIds.has(view.typeId)), [views, typeIds]);
  const availableAutomations = useMemo(
    () => automations.filter((automation) => automation.typeId && typeIds.has(automation.typeId)),
    [automations, typeIds],
  );

  function toggleType(id: string) {
    setTypeIds((prev) => {
      const next = toggleId(prev, id);
      if (!next.has(id)) {
        setViewIds((current) => new Set([...current].filter((viewId) => views.find((view) => view.id === viewId)?.typeId !== id)));
        setAutomationIds((current) => new Set([...current].filter((autoId) => automations.find((a) => a.id === autoId)?.typeId !== id)));
      }
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await exportPackAction({
        key,
        version,
        name,
        description: description || undefined,
        icon: icon || undefined,
        typeIds: [...typeIds],
        viewIds: [...viewIds],
        automationIds: [...automationIds],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      downloadJson(result.data.filename, result.data.json);
      setSuccess(`Baixado: ${result.data.filename}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Chave (ex.: meu-pack)" value={key} onChange={(event) => setKey(event.target.value)} className={inputClassName} />
        <input placeholder="Versão (ex.: 1.0.0)" value={version} onChange={(event) => setVersion(event.target.value)} className={inputClassName} />
        <input placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} className={inputClassName} />
        <input placeholder="🙂" value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={4} className={inputClassName} />
      </div>
      <textarea
        placeholder="Descrição"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className={`${inputClassName} min-h-16`}
      />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-black dark:text-zinc-50">Tipos</legend>
        {types.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum tipo ainda.</p>}
        {types.map((type) => (
          <label key={type.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" checked={typeIds.has(type.id)} onChange={() => toggleType(type.id)} />
            {type.icon ? `${type.icon} ` : ""}
            {type.name}
          </label>
        ))}
      </fieldset>

      {availableViews.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-black dark:text-zinc-50">Visões</legend>
          {availableViews.map((view) => (
            <label key={view.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <input type="checkbox" checked={viewIds.has(view.id)} onChange={() => setViewIds((prev) => toggleId(prev, view.id))} />
              {view.name} ({view.kind})
            </label>
          ))}
        </fieldset>
      )}

      {availableAutomations.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-black dark:text-zinc-50">Automações</legend>
          {availableAutomations.map((automation) => (
            <label key={automation.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={automationIds.has(automation.id)}
                onChange={() => setAutomationIds((prev) => toggleId(prev, automation.id))}
              />
              {automation.name}
            </label>
          ))}
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || typeIds.size === 0}
        className="bg-foreground text-background self-start rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Gerando..." : "Baixar JSON"}
      </button>
    </div>
  );
}
