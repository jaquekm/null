"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { slugify } from "@/lib/slugify";
import type { Json } from "@/lib/supabase/database.types";
import { canChangeFieldType } from "./lib/field-compat";
import { uniqueFieldKey } from "./lib/field-key";
import { objectTypeInputSchema } from "./object-type-schemas";
import { fieldDefinitionSchema, fieldTypes, type FieldDefinition, type SelectOption } from "./schemas";

const GENERIC_ERROR = "Não foi possível salvar. Tente de novo.";
const UNIQUE_VIOLATION = "23505";

function toTypeRow(input: z.infer<typeof objectTypeInputSchema>) {
  return {
    name: input.name,
    plural_name: input.pluralName || null,
    icon: input.icon || null,
    color: input.color || null,
    space_id: input.spaceId ?? null,
    default_view: input.defaultView,
    title_template: input.titleTemplate || null,
  };
}

function parseTypeForm(formData: FormData) {
  return objectTypeInputSchema.safeParse({
    name: formData.get("name"),
    pluralName: formData.get("pluralName") ?? undefined,
    icon: formData.get("icon") ?? undefined,
    color: formData.get("color") ?? undefined,
    spaceId: formData.get("spaceId") || undefined,
    defaultView: formData.get("defaultView") || "list",
    titleTemplate: formData.get("titleTemplate") ?? undefined,
  });
}

export async function createObjectType(
  _prevState: Result<{ slug: string } | null>,
  formData: FormData,
): Promise<Result<{ slug: string } | null>> {
  const parsed = parseTypeForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR, parsed.error.flatten().fieldErrors);
  }

  const { supabase, user } = await requireOwner();

  const { data: last } = await supabase
    .from("object_types")
    .select("position")
    .eq("owner_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const slug = slugify(parsed.data.name) || `tipo-${Date.now()}`;

  const { error } = await supabase.from("object_types").insert({
    owner_id: user.id,
    slug,
    position: (last?.position ?? -1) + 1,
    is_system: false,
    fields: [],
    ...toTypeRow(parsed.data),
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return fail("Já existe um tipo com esse nome.", { name: ["Já existe um tipo com esse nome."] });
    }
    return fail(GENERIC_ERROR);
  }

  revalidatePath("/configuracoes/tipos");
  return ok({ slug });
}

export async function updateObjectType(
  typeId: string,
  _prevState: Result<null>,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = parseTypeForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR, parsed.error.flatten().fieldErrors);
  }

  const { supabase, user } = await requireOwner();

  const { error } = await supabase
    .from("object_types")
    .update(toTypeRow(parsed.data))
    .eq("id", typeId)
    .eq("owner_id", user.id);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/configuracoes/tipos");
  return ok(null);
}

export async function duplicateObjectType(typeId: string): Promise<Result<{ slug: string } | null>> {
  const { supabase, user } = await requireOwner();

  const { data: original, error: readError } = await supabase
    .from("object_types")
    .select("name, plural_name, icon, color, space_id, fields, template, title_template, default_view, position")
    .eq("id", typeId)
    .maybeSingle();

  if (readError || !original) return fail("Tipo não encontrado.");

  const name = `${original.name} (cópia)`;
  const slug = `${slugify(name)}-${Date.now().toString(36)}`;

  const { error } = await supabase.from("object_types").insert({
    owner_id: user.id,
    space_id: original.space_id,
    name,
    plural_name: original.plural_name,
    slug,
    icon: original.icon,
    color: original.color,
    fields: original.fields,
    template: original.template,
    title_template: original.title_template,
    default_view: original.default_view,
    is_system: false,
    position: original.position + 0.5,
  });

  if (error) return fail("Não foi possível duplicar o tipo.");

  revalidatePath("/configuracoes/tipos");
  return ok({ slug });
}

const fieldFormSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome ao campo."),
  type: z.enum(fieldTypes),
  required: z.boolean(),
  description: z.string().trim().max(300).optional(),
  optionsJson: z.string().optional(),
  relationTypeId: z.string().uuid().optional(),
  multiple: z.boolean(),
  currency: z.string().trim().max(10).optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  showInCard: z.boolean(),
});

function readFieldForm(formData: FormData) {
  return {
    label: formData.get("label"),
    type: formData.get("type"),
    required: formData.get("required") === "on",
    description: formData.get("description") || undefined,
    optionsJson: formData.get("optionsJson") || undefined,
    relationTypeId: formData.get("relationTypeId") || undefined,
    multiple: formData.get("multiple") === "on",
    currency: formData.get("currency") || undefined,
    min: formData.get("min") || undefined,
    max: formData.get("max") || undefined,
    showInCard: formData.get("showInCard") === "on",
  };
}

function parseOptions(optionsJson: string | undefined): SelectOption[] | undefined {
  if (!optionsJson) return undefined;
  try {
    const raw: unknown = JSON.parse(optionsJson);
    return Array.isArray(raw) ? (raw as SelectOption[]) : undefined;
  } catch {
    return undefined;
  }
}

async function loadFields(
  supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"],
  typeId: string,
): Promise<FieldDefinition[] | null> {
  const { data, error } = await supabase.from("object_types").select("fields").eq("id", typeId).maybeSingle();
  if (error || !data) return null;
  return (data.fields as unknown as FieldDefinition[] | null) ?? [];
}

export async function addField(typeId: string, _prevState: Result<null>, formData: FormData): Promise<Result<null>> {
  const parsedForm = fieldFormSchema.safeParse(readFieldForm(formData));
  if (!parsedForm.success) return fail(parsedForm.error.issues[0]?.message ?? GENERIC_ERROR);

  const { supabase, user } = await requireOwner();
  const existingFields = await loadFields(supabase, typeId);
  if (existingFields === null) return fail("Tipo não encontrado.");

  const key = uniqueFieldKey(
    parsedForm.data.label,
    existingFields.map((f) => f.key),
  );

  const candidate = fieldDefinitionSchema.safeParse({
    key,
    label: parsedForm.data.label,
    type: parsedForm.data.type,
    required: parsedForm.data.required,
    description: parsedForm.data.description,
    options: parseOptions(parsedForm.data.optionsJson),
    relationTypeId: parsedForm.data.relationTypeId,
    multiple: parsedForm.data.multiple,
    currency: parsedForm.data.currency,
    min: parsedForm.data.min,
    max: parsedForm.data.max,
    showInCard: parsedForm.data.showInCard,
  });
  if (!candidate.success) return fail(candidate.error.issues[0]?.message ?? GENERIC_ERROR);

  const { error } = await supabase
    .from("object_types")
    .update({ fields: [...existingFields, candidate.data] as unknown as Json })
    .eq("id", typeId)
    .eq("owner_id", user.id);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/configuracoes/tipos");
  return ok(null);
}

export async function updateField(
  typeId: string,
  fieldKey: string,
  _prevState: Result<null>,
  formData: FormData,
): Promise<Result<null>> {
  const parsedForm = fieldFormSchema.safeParse(readFieldForm(formData));
  if (!parsedForm.success) return fail(parsedForm.error.issues[0]?.message ?? GENERIC_ERROR);

  const { supabase, user } = await requireOwner();
  const existingFields = await loadFields(supabase, typeId);
  if (existingFields === null) return fail("Tipo não encontrado.");

  const index = existingFields.findIndex((f) => f.key === fieldKey);
  if (index === -1) return fail("Campo não encontrado.");

  const current = existingFields[index]!;
  if (!canChangeFieldType(current.type, parsedForm.data.type)) {
    return fail(
      `Não é possível mudar um campo de "${current.type}" para "${parsedForm.data.type}" — os tipos não são compatíveis. Crie um campo novo.`,
    );
  }

  const candidate = fieldDefinitionSchema.safeParse({
    key: fieldKey,
    label: parsedForm.data.label,
    type: parsedForm.data.type,
    required: parsedForm.data.required,
    description: parsedForm.data.description,
    options: parseOptions(parsedForm.data.optionsJson),
    relationTypeId: parsedForm.data.relationTypeId,
    multiple: parsedForm.data.multiple,
    currency: parsedForm.data.currency,
    min: parsedForm.data.min,
    max: parsedForm.data.max,
    showInCard: parsedForm.data.showInCard,
  });
  if (!candidate.success) return fail(candidate.error.issues[0]?.message ?? GENERIC_ERROR);

  const nextFields = [...existingFields];
  nextFields[index] = candidate.data;

  const { error } = await supabase
    .from("object_types")
    .update({ fields: nextFields as unknown as Json })
    .eq("id", typeId)
    .eq("owner_id", user.id);

  if (error) return fail(GENERIC_ERROR);

  revalidatePath("/configuracoes/tipos");
  return ok(null);
}

/** O chamador deve confirmar com o usuário antes — spec 1.5: "os valores existentes ficarão ocultos". */
export async function removeField(typeId: string, fieldKey: string): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const existingFields = await loadFields(supabase, typeId);
  if (existingFields === null) return fail("Tipo não encontrado.");

  const nextFields = existingFields.filter((f) => f.key !== fieldKey);

  const { error } = await supabase
    .from("object_types")
    .update({ fields: nextFields as unknown as Json })
    .eq("id", typeId)
    .eq("owner_id", user.id);

  if (error) return fail("Não foi possível remover o campo.");

  revalidatePath("/configuracoes/tipos");
  return ok(null);
}

export async function reorderFields(typeId: string, orderedKeys: string[]): Promise<Result<null>> {
  const { supabase, user } = await requireOwner();
  const existingFields = await loadFields(supabase, typeId);
  if (existingFields === null) return fail("Tipo não encontrado.");

  const byKey = new Map(existingFields.map((f) => [f.key, f]));
  const nextFields = orderedKeys.map((key) => byKey.get(key)).filter((f): f is FieldDefinition => Boolean(f));

  if (nextFields.length !== existingFields.length) return fail("Lista de campos inconsistente.");

  const { error } = await supabase
    .from("object_types")
    .update({ fields: nextFields as unknown as Json })
    .eq("id", typeId)
    .eq("owner_id", user.id);

  if (error) return fail("Não foi possível reordenar os campos.");

  revalidatePath("/configuracoes/tipos");
  return ok(null);
}
