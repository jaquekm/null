import type { FieldDefinition } from "@/features/types/schemas";
import type { XlsxCell, XlsxSheet } from "@/lib/xlsx/write";

/** Campos que não fazem sentido numa planilha (ids de outros registros e arquivos). */
const SKIPPED: FieldDefinition["type"][] = ["relation", "contact", "file"];

export function exportableFields(fields: FieldDefinition[], visibleFields?: string[]): FieldDefinition[] {
  return fields.filter((field) => !field.hidden && !SKIPPED.includes(field.type) && (!visibleFields || visibleFields.includes(field.key)));
}

function cellFor(field: FieldDefinition, value: unknown, timezone: string): XlsxCell {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  switch (field.type) {
    case "money":
      return Number.isFinite(number) ? { money: number / 100 } : null;
    case "percent":
      return Number.isFinite(number) ? { percent: number / 100 } : null;
    case "number":
    case "rating":
    case "duration":
    case "rollup":
      return Number.isFinite(number) ? number : null;
    case "formula":
      if (!Number.isFinite(number)) return null;
      if (field.formulaFormat === "money") return { money: number / 100 };
      if (field.formulaFormat === "percent") return { percent: number / 100 };
      return number;
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? { date: String(value) } : String(value);
    case "datetime": {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return String(value);
      // Hora de parede no fuso da dona (o banco guarda em UTC).
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
      return { date: `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}` };
    }
    case "checkbox":
      return value ? "Sim" : "Não";
    case "select":
      return field.options?.find((option) => option.id === value)?.label ?? String(value);
    case "multi_select":
      return (Array.isArray(value) ? value : []).map((id) => field.options?.find((option) => option.id === id)?.label ?? String(id)).join(", ");
    default:
      return String(value);
  }
}

/** Linhas da visão → planilha: "Título" + as colunas visíveis, cada uma no formato certo pro Excel. */
export function buildExportSheet(
  name: string,
  rows: { title: string; properties: Record<string, unknown> }[],
  fields: FieldDefinition[],
  timezone: string,
): XlsxSheet {
  return {
    name,
    header: ["Título", ...fields.map((field) => field.label)],
    rows: rows.map((row) => [row.title || "Sem título", ...fields.map((field) => cellFor(field, row.properties[field.key], timezone))]),
  };
}
