// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RECIPES, type RecipeKey, type RecipeState } from "../lib/recipes";
import { RecipeList } from "./recipe-list";

const setRecipeActive = vi.fn<(input: unknown) => Promise<{ ok: true; data: null } | { ok: false; error: string }>>(async () => ({ ok: true, data: null }));
vi.mock("../recipe-actions", () => ({ setRecipeActive: (input: unknown) => setRecipeActive(input) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  setRecipeActive.mockClear();
});

function states(overrides: Partial<Record<RecipeKey, RecipeState>> = {}): Record<RecipeKey, RecipeState> {
  const base = Object.fromEntries(RECIPES.map((recipe) => [recipe.key, { active: false, channel: recipe.channels[0] ?? null, sourceId: null }])) as Record<RecipeKey, RecipeState>;
  return { ...base, ...overrides };
}

describe("RecipeList", () => {
  it("mostra cada receita como frase, com um interruptor", () => {
    render(<RecipeList states={states()} ownerWhatsapp={null} />);
    const toggle = screen.getByRole("switch", { name: "Quando uma conta a pagar vencer amanhã, me avisar por notificação — e de novo no dia" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.getAllByRole("switch")).toHaveLength(RECIPES.length);
  });

  it("um toque liga a receita no canal escolhido", async () => {
    render(<RecipeList states={states()} ownerWhatsapp="+5511988887777" />);
    const card = screen.getByRole("switch", { name: /conta a pagar/ }).closest("li")!;
    fireEvent.click(card.querySelector('[role="radio"][aria-checked="false"]')!); // escolhe WhatsApp antes de ligar
    fireEvent.click(screen.getByRole("switch", { name: /conta a pagar vencer amanhã, me avisar no WhatsApp/ }));
    await waitFor(() => expect(setRecipeActive).toHaveBeenCalledWith({ key: "conta-a-pagar", active: true, channel: "whatsapp" }));
    expect(screen.getByRole("switch", { name: /conta a pagar/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("sem WhatsApp cadastrado: opção desabilitada e aviso pra cadastrar", () => {
    render(<RecipeList states={states()} ownerWhatsapp={null} />);
    expect(screen.getByRole("link", { name: "Cadastre seu número" }).getAttribute("href")).toBe("/configuracoes/notificacoes");
    const whatsapp = screen.getAllByRole("radio", { name: "WhatsApp" });
    expect(whatsapp.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("receita ligada mostra 'Ajustar' apontando pra regra/automação", () => {
    render(<RecipeList states={states({ "tag-urgente": { active: true, channel: "push", sourceId: "a1" } })} ownerWhatsapp={null} />);
    expect(screen.getByRole("link", { name: "Ajustar" }).getAttribute("href")).toBe("/configuracoes/automacoes/a1");
  });

  it("erro do servidor volta o interruptor", async () => {
    setRecipeActive.mockResolvedValueOnce({ ok: false, error: "falhou" });
    render(<RecipeList states={states()} ownerWhatsapp={null} />);
    const toggle = screen.getByRole("switch", { name: /aniversário/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(setRecipeActive).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("switch", { name: /aniversário/ }).getAttribute("aria-checked")).toBe("false"));
  });
});
