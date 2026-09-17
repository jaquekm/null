"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type FactorSummary = {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
};

export function MfaSection({
  initialFactors,
}: {
  initialFactors: FactorSummary[];
}) {
  const [factors, setFactors] = useState(initialFactors);
  const [enrolling, setEnrolling] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshFactors() {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(
      (data?.totp ?? []).map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name ?? null,
        status: factor.status,
      })),
    );
  }

  async function startEnroll() {
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
    });
    setBusy(false);

    if (error || !data) {
      toast.error("Não foi possível iniciar o cadastro do autenticador.");
      return;
    }

    setEnrolling({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function confirmEnroll() {
    if (!enrolling) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrolling.factorId,
      code,
    });
    setBusy(false);

    if (error) {
      toast.error("Código inválido.");
      return;
    }

    toast.success("Autenticador cadastrado.");
    setEnrolling(null);
    setCode("");
    await refreshFactors();
  }

  function cancelEnroll() {
    setEnrolling(null);
    setCode("");
  }

  async function removeFactor(factorId: string) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);

    if (error) {
      toast.error("Não foi possível remover o autenticador.");
      return;
    }

    toast.success("Autenticador removido.");
    await refreshFactors();
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Autenticação em duas etapas
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Exige um código do seu aplicativo autenticador (Google Authenticator,
          1Password etc.) além da senha.
        </p>
      </div>

      {factors.length > 0 && (
        <ul className="flex flex-col gap-2">
          {factors.map((factor) => (
            <li
              key={factor.id}
              className="flex items-center justify-between rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.08]"
            >
              <span>
                {factor.friendlyName ?? "Autenticador"} —{" "}
                {factor.status === "verified"
                  ? "ativo"
                  : "pendente de confirmação"}
              </span>
              <button
                type="button"
                onClick={() => removeFactor(factor.id)}
                disabled={busy}
                className="text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {!enrolling && (
        <button
          type="button"
          onClick={startEnroll}
          disabled={busy}
          className="self-start rounded-full bg-black/[.06] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.1] disabled:opacity-60 dark:bg-white/[.08] dark:text-zinc-50 dark:hover:bg-white/[.14]"
        >
          Adicionar autenticador
        </button>
      )}

      {enrolling && (
        <div className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.08]">
          {/* SVG gerado pelo Supabase a cada cadastro (data: URI): next/image não otimiza nem se aplica aqui. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrolling.qrCode}
            alt="QR code para configurar o autenticador"
            className="h-40 w-40 self-center"
          />
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            Não conseguiu escanear? Digite manualmente:{" "}
            <code className="font-mono">{enrolling.secret}</code>
          </p>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="Código de 6 dígitos"
            className="rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-center tracking-[0.3em] focus:ring-2 focus:ring-black/20 focus:outline-none dark:border-white/[.16] dark:focus:ring-white/20"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmEnroll}
              disabled={busy || code.length !== 6}
              className="bg-foreground text-background flex-1 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={cancelEnroll}
              className="rounded-full px-4 py-2 text-sm text-zinc-600 hover:bg-black/[.04] dark:text-zinc-300 dark:hover:bg-white/[.06]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
