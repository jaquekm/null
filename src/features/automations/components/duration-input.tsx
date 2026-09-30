"use client";

const UNITS = [
  { value: 1, label: "minutos" },
  { value: 60, label: "horas" },
  { value: 1440, label: "dias" },
] as const;

const inputClassName =
  "rounded-lg border border-black/[.12] bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:border-white/[.16] dark:focus:ring-white/20";

function split(minutes: number): { amount: number; unit: number } {
  const abs = Math.abs(minutes);
  if (abs !== 0 && abs % 1440 === 0) return { amount: abs / 1440, unit: 1440 };
  if (abs !== 0 && abs % 60 === 0) return { amount: abs / 60, unit: 60 };
  return { amount: abs, unit: abs === 0 ? 1440 : 1 };
}

/**
 * Tempo em "número + unidade" em vez de minutos crus (9.8). Com `relative`,
 * também "no dia / antes / depois" — negativo é antes (gatilho de data).
 */
export function DurationInput({ minutes, relative = false, onChange }: { minutes: number; relative?: boolean; onChange: (minutes: number) => void }) {
  const { amount, unit } = split(minutes);
  const direction = minutes === 0 ? "on" : minutes < 0 ? "before" : "after";

  function emit(nextAmount: number, nextUnit: number, nextDirection: string) {
    if (nextDirection === "on") return onChange(0);
    const value = Math.max(0, Math.round(nextAmount)) * nextUnit;
    onChange(relative && nextDirection === "before" ? -value : value);
  }

  const amountAndUnit = (
    <>
      <input
        type="number"
        min={0}
        aria-label="Quanto tempo"
        value={amount}
        onChange={(event) => emit(Number(event.target.value), unit, direction === "on" ? "before" : direction)}
        className={`${inputClassName} w-16`}
      />
      <select aria-label="Unidade" value={unit} onChange={(event) => emit(amount || 1, Number(event.target.value), direction === "on" ? "before" : direction)} className={inputClassName}>
        {UNITS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );

  if (!relative) return <span className="flex items-center gap-1.5">{amountAndUnit}</span>;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <select aria-label="Quando em relação à data" value={direction} onChange={(event) => emit(amount || 1, unit, event.target.value)} className={inputClassName}>
        <option value="on">no dia</option>
        <option value="before">antes</option>
        <option value="after">depois</option>
      </select>
      {direction !== "on" && amountAndUnit}
    </span>
  );
}
