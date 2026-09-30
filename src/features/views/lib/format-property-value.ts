import type { FieldDefinition } from "@/features/types/schemas";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

/** Valor de `properties[key]` em texto curto — Lista e card do Kanban (1.15). */
export function formatPropertyValue(value: unknown, field: FieldDefinition): string {
  if (value === undefined || value === null || value === "") return "—";

  switch (field.type) {
    case "checkbox":
      return value ? "Sim" : "Não";

    case "select": {
      const option = field.options?.find((opt) => opt.id === value);
      return option?.label ?? String(value);
    }

    case "multi_select": {
      const ids = Array.isArray(value) ? value : [];
      if (ids.length === 0) return "—";
      return ids.map((id) => field.options?.find((opt) => opt.id === id)?.label ?? String(id)).join(", ");
    }

    case "money": {
      const cents = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(cents)) return "—";
      return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: field.currency ?? "BRL" });
    }

    case "percent":
      return `${value}%`;

    case "rollup":
      return field.rollupOp === "percent" ? `${value}%` : String(value);

    case "formula": {
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(number)) return "—";
      if (field.formulaFormat === "money") return (number / 100).toLocaleString("pt-BR", { style: "currency", currency: field.currency ?? "BRL" });
      if (field.formulaFormat === "percent") return `${number.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
      return number.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
    }

    case "date": {
      const [year, month, day] = String(value).split("-");
      return year && month && day ? `${day}/${month}/${year}` : String(value);
    }

    case "datetime": {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR", { timeZone: DEFAULT_TIMEZONE });
    }

    default:
      return String(value);
  }
}
