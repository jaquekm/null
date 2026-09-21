"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SidebarSpace } from "@/features/spaces/queries";
import { createPixKey, deletePixKey, setDefaultPixKey } from "../actions";
import type { PixKeyRow } from "../queries";
import { PIX_KEY_TYPES, PIX_KEY_TYPE_LABELS, type PixKeyType } from "../schemas";

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";
const labelClassName = "flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function PixKeySection({ pixKeys, spaces }: { pixKeys: PixKeyRow[]; spaces: SidebarSpace[] }) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [keyType, setKeyType] = useState<PixKeyType>("email");
  const [keyValue, setKeyValue] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [isDefault, setIsDefault] = useState(pixKeys.length === 0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function resetForm() {
    setLabel("");
    setKeyType("email");
    setKeyValue("");
    setMerchantName("");
    setMerchantCity("");
    setSpaceId("");
    setIsDefault(false);
    setFieldErrors({});
  }

  function handleCreate() {
    setFieldErrors({});
    startTransition(async () => {
      const result = await createPixKey({ label, keyType, keyValue, merchantName, merchantCity, spaceId: spaceId || undefined, isDefault });
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      toast.success("Chave Pix cadastrada.");
      resetForm();
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deletePixKey(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const result = await setDefaultPixKey(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-black dark:text-zinc-50">3. Chaves Pix (opcional)</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Usadas depois pra gerar a página pública de cobrança.</p>

      {pixKeys.length > 0 && (
        <ul className="flex flex-col gap-1">
          {pixKeys.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]">
              <div className="flex flex-col">
                <span className="font-medium text-black dark:text-zinc-50">
                  {key.label}
                  {key.isDefault && <span className="ml-2 rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-normal dark:bg-white/[.1]">Padrão</span>}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {PIX_KEY_TYPE_LABELS[key.keyType]} · {key.keyValue}
                </span>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                {!key.isDefault && (
                  <button type="button" onClick={() => handleSetDefault(key.id)} disabled={pending} className="text-zinc-500 hover:underline disabled:opacity-60">
                    Tornar padrão
                  </button>
                )}
                <button type="button" onClick={() => handleDelete(key.id)} disabled={pending} className="text-red-500 hover:underline disabled:opacity-60">
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-3 dark:border-white/[.08]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClassName}>
              Rótulo*
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Pessoal, Empresa X..." className={inputClassName} disabled={pending} />
              {fieldErrors.label && <span className="text-red-500">{fieldErrors.label[0]}</span>}
            </label>
            <label className={labelClassName}>
              Tipo de chave
              <select value={keyType} onChange={(e) => setKeyType(e.target.value as PixKeyType)} className={inputClassName} disabled={pending}>
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PIX_KEY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Chave*
              <input value={keyValue} onChange={(e) => setKeyValue(e.target.value)} className={inputClassName} disabled={pending} />
              {fieldErrors.keyValue && <span className="text-red-500">{fieldErrors.keyValue[0]}</span>}
            </label>
            <label className={labelClassName}>
              Espaço
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={inputClassName} disabled={pending}>
                <option value="">Nenhum</option>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Nome do recebedor* (até 25 caracteres)
              <input value={merchantName} onChange={(e) => setMerchantName(e.target.value)} maxLength={25} className={inputClassName} disabled={pending} />
              {fieldErrors.merchantName && <span className="text-red-500">{fieldErrors.merchantName[0]}</span>}
            </label>
            <label className={labelClassName}>
              Cidade* (até 15 caracteres)
              <input value={merchantCity} onChange={(e) => setMerchantCity(e.target.value)} maxLength={15} className={inputClassName} disabled={pending} />
              {fieldErrors.merchantCity && <span className="text-red-500">{fieldErrors.merchantCity[0]}</span>}
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} disabled={pending} />
            Usar como chave padrão
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending || !label.trim() || !keyValue.trim() || !merchantName.trim() || !merchantCity.trim()}
              className="bg-foreground text-background self-start rounded-full px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Cadastrar chave"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              disabled={pending}
              className="self-start rounded-full px-5 py-2 text-sm text-zinc-500 hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="self-start text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          + Nova chave Pix
        </button>
      )}
    </div>
  );
}
