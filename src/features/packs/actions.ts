"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { fail, ok, type Result } from "@/lib/result";
import { buildPackExport } from "./lib/export";
import { installPack, type InstallPackOptions, type InstallPackSummary } from "./lib/install";
import { getPackUninstallPreview, uninstallPack, type PackUninstallPreview, type UninstallPackSummary } from "./lib/uninstall";
import { listLocalPacks } from "./queries";

const GENERIC_ERROR = "Não foi possível concluir. Tente de novo.";

const typeOverrideSchema = z.object({
  name: z.string().trim().min(1).optional(),
  plural: z.string().trim().min(1).optional(),
  icon: z.string().trim().max(8).optional(),
  fields: z
    .record(
      z.string(),
      z.object({
        label: z.string().trim().min(1).optional(),
        options: z.record(z.string(), z.string().trim().min(1)).optional(),
      }),
    )
    .optional(),
});

const installInputSchema = z.object({
  file: z.string().min(1),
  spaceId: z.string().uuid().nullable(),
  withSamples: z.boolean().default(false),
  typeOverrides: z.record(z.string(), typeOverrideSchema).optional(),
});

/** Instala um pack local (`packs/<chave>.json`, 5.2) — lê e revalida o arquivo no servidor, nunca confia num pack vindo do cliente. */
export async function installPackAction(input: unknown): Promise<Result<InstallPackSummary>> {
  const parsed = installInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const entries = await listLocalPacks();
  const entry = entries.find((candidate) => candidate.file === parsed.data.file);
  if (!entry || !entry.pack) return fail("Pack não encontrado ou inválido.");

  const { supabase, user } = await requireOwner();
  const options: InstallPackOptions = {
    spaceId: parsed.data.spaceId,
    withSamples: parsed.data.withSamples,
    typeOverrides: parsed.data.typeOverrides,
  };
  const result = await installPack(supabase, user.id, entry.pack, options);
  if (result.ok) {
    revalidatePath("/configuracoes/metodos");
    revalidatePath("/configuracoes/tipos");
  }
  return result;
}

export async function getPackUninstallPreviewAction(installedId: string): Promise<PackUninstallPreview | null> {
  const { supabase, user } = await requireOwner();
  return getPackUninstallPreview(supabase, user.id, installedId);
}

export async function uninstallPackAction(installedId: string, archiveTypesWithItems: boolean): Promise<Result<UninstallPackSummary>> {
  const { supabase, user } = await requireOwner();
  const result = await uninstallPack(supabase, user.id, installedId, archiveTypesWithItems);
  if (result.ok) {
    revalidatePath("/configuracoes/metodos");
    revalidatePath("/configuracoes/tipos");
  }
  return result;
}

const exportInputSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9-]*$/, "Chave deve começar com letra minúscula e usar só letras, números ou `-` (ex.: meu-pack)."),
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Versão deve seguir semver (ex.: 1.0.0)."),
  name: z.string().trim().min(1, "Dê um nome ao pack."),
  description: z.string().trim().optional(),
  icon: z.string().trim().max(8).optional(),
  typeIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um tipo."),
  viewIds: z.array(z.string().uuid()).default([]),
  automationIds: z.array(z.string().uuid()).default([]),
});

export interface ExportedPackFile {
  filename: string;
  json: string;
}

/** "Exportar como pack" (5.2, `/configuracoes/tipos`) — devolve o JSON pronto pro cliente baixar. */
export async function exportPackAction(input: unknown): Promise<Result<ExportedPackFile>> {
  const parsed = exportInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const { supabase, user } = await requireOwner();
  const result = await buildPackExport(supabase, user.id, parsed.data);
  if (!result.ok) return result;

  return ok({ filename: `${result.data.key}.json`, json: JSON.stringify(result.data, null, 2) });
}
