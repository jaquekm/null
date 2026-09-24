"use client";

import { useState } from "react";
import { COLOR_TOKENS, type ColorToken, colorDotClassName, colorLabel, isColorToken } from "@/lib/color-tokens";

const DEFAULT_TOKEN: ColorToken = "slate";

function normalize(value: string | null | undefined): ColorToken {
  return isColorToken(value) ? value : DEFAULT_TOKEN;
}

/**
 * Seletor de cor categórica (9 tokens fixos de `color-tokens.ts`). Dois modos:
 * - com `name`: não-controlado, publica um `<input type="hidden">` pra
 *   participar de forms de server action comuns no projeto (`useActionState`
 *   + `FormData`) — ver `TagRenameForm`, `SpaceSettingsForm`.
 * - com `value`/`onChange`: controlado, pro caso de o pai já guardar o estado
 *   (ex.: lista de espaços do onboarding, serializada em `spacesJson`).
 */
export function ColorPicker({
  name,
  value,
  defaultValue,
  onChange,
  "aria-label": ariaLabel = "Cor",
}: {
  name?: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (token: ColorToken) => void;
  "aria-label"?: string;
}) {
  const [internal, setInternal] = useState<ColorToken>(normalize(defaultValue));
  const selected = value !== undefined ? normalize(value) : internal;

  function select(token: ColorToken) {
    if (value === undefined) setInternal(token);
    onChange?.(token);
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {name && <input type="hidden" name={name} value={selected} />}
      {COLOR_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          role="radio"
          aria-checked={selected === token}
          aria-label={colorLabel(token)}
          title={colorLabel(token)}
          onClick={() => select(token)}
          className={`h-6 w-6 shrink-0 rounded-full transition-all ${colorDotClassName(token)} ${
            selected === token
              ? "scale-110 ring-2 ring-black/50 dark:ring-white/60"
              : "opacity-60 hover:scale-110 hover:opacity-100"
          }`}
        />
      ))}
    </div>
  );
}
