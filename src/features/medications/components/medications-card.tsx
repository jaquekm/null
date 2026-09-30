"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createMedication, deleteMedication, setMedicationSchedule, setMedicationStock, takeMedicationDose } from "../actions";
import { formatHorarios } from "../lib/medication-stock";
import type { MedicationForToday } from "../queries";

const inputClassName = "rounded-lg border border-black/[.12] bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function parseHorarios(raw: string): string[] {
  return raw
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

function parseStock(raw: string): number | null {
  return raw.trim() === "" ? null : Number(raw);
}

function MedicationRow({ medication, onDeleted }: { medication: MedicationForToday; onDeleted: (id: string) => void }) {
  const [stock, setStock] = useState(medication.stock);
  const [lowStock, setLowStock] = useState(medication.lowStock);
  const [editing, setEditing] = useState(false);
  const [horariosInput, setHorariosInput] = useState(medication.horarios.join(", "));
  const [stockInput, setStockInput] = useState(medication.stock == null ? "" : String(medication.stock));
  const [pending, startTransition] = useTransition();

  function handleTake() {
    startTransition(async () => {
      const result = await takeMedicationDose(medication.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStock(result.data.stock);
      setLowStock(result.data.lowStock);
      if (result.data.lowStock) {
        toast.warning(
          result.data.addedToShoppingList
            ? `${medication.title}: acaba em poucos dias — somei na lista de compras.`
            : `${medication.title}: acaba em poucos dias.`,
        );
      } else {
        toast.success("Registrado.");
      }
    });
  }

  function handleSave() {
    const horarios = parseHorarios(horariosInput);
    const stockValue = parseStock(stockInput);
    if (stockValue != null && (!Number.isInteger(stockValue) || stockValue < 0)) {
      toast.error("Estoque inválido.");
      return;
    }
    startTransition(async () => {
      const [scheduleResult, stockResult] = await Promise.all([
        setMedicationSchedule(medication.id, horarios),
        setMedicationStock(medication.id, stockValue),
      ]);
      if (!scheduleResult.ok) {
        toast.error(scheduleResult.error);
        return;
      }
      if (!stockResult.ok) {
        toast.error(stockResult.error);
        return;
      }
      setStock(stockValue);
      setEditing(false);
      toast.success("Salvo.");
    });
  }

  function handleDelete() {
    if (!window.confirm(`Excluir "${medication.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteMedication(medication.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onDeleted(medication.id);
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl bg-surface-muted px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            className="truncate text-left text-sm font-medium text-black hover:underline dark:text-zinc-100"
          >
            {medication.title}
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {medication.dose ? `${medication.dose} · ` : ""}
            {formatHorarios(medication.horarios)}
            {stock != null && ` · estoque: ${stock}`}
          </p>
          {lowStock && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Acaba em poucos dias</p>}
        </div>
        <button
          type="button"
          onClick={handleTake}
          disabled={pending}
          className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          Tomei
        </button>
      </div>

      {editing && (
        <div className="flex flex-col gap-2 border-t border-black/[.06] pt-2 dark:border-white/[.08]">
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Horários (ex.: 08:00, 20:00)
            <input value={horariosInput} onChange={(e) => setHorariosInput(e.target.value)} className={inputClassName} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            Estoque (unidades)
            <input value={stockInput} onChange={(e) => setStockInput(e.target.value)} inputMode="numeric" className={inputClassName} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={handleSave} disabled={pending} className="bg-brand text-brand-fg rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-60">
              Salvar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 dark:border-red-900 dark:text-red-400"
            >
              Excluir remédio
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Card "Remédios" do Hoje (10.5): lista, "Tomei" (desconta estoque), horários/estoque e "+ Remédio". */
export function MedicationsCard({ medications: initialMedications }: { medications: MedicationForToday[] }) {
  const [medications, setMedications] = useState(initialMedications);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dose, setDose] = useState("");
  const [horarios, setHorarios] = useState("");
  const [stock, setStock] = useState("");
  const [pending, startTransition] = useTransition();

  function handleDeleted(id: string) {
    setMedications((current) => current.filter((m) => m.id !== id));
  }

  function handleCreate() {
    if (!title.trim()) {
      toast.error("Dê um nome ao remédio.");
      return;
    }
    const stockValue = parseStock(stock);
    if (stockValue != null && (!Number.isInteger(stockValue) || stockValue < 0)) {
      toast.error("Estoque inválido.");
      return;
    }
    const parsedHorarios = parseHorarios(horarios);

    startTransition(async () => {
      const result = await createMedication({ title, dose: dose.trim() || undefined, horarios: parsedHorarios, stock: stockValue });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMedications((current) =>
        [
          ...current,
          { id: result.data.id, title, dose: dose.trim() || null, horarios: parsedHorarios, stock: stockValue, daysLeft: null, lowStock: false },
        ].sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
      );
      setTitle("");
      setDose("");
      setHorarios("");
      setStock("");
      setAdding(false);
      toast.success("Remédio adicionado.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {medications.length === 0 ? (
        <p className="rounded-xl bg-surface-muted px-3 py-3 text-sm text-zinc-500 dark:text-zinc-400">Nenhum remédio cadastrado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {medications.map((medication) => (
            <MedicationRow key={medication.id} medication={medication} onDeleted={handleDeleted} />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface-muted px-3 py-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome (ex.: Vitamina D)" className={inputClassName} />
          <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose (ex.: 1 comprimido)" className={inputClassName} />
          <input value={horarios} onChange={(e) => setHorarios(e.target.value)} placeholder="Horários, ex.: 08:00, 20:00" className={inputClassName} />
          <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" placeholder="Estoque (unidades)" className={inputClassName} />
          <div className="flex gap-2">
            <button type="button" onClick={handleCreate} disabled={pending} className="bg-brand text-brand-fg rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60">
              Adicionar
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm dark:border-white/[.16]">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="self-start text-sm font-medium text-brand-text hover:underline">
          + Remédio
        </button>
      )}
    </div>
  );
}
