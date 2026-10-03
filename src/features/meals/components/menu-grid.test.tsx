// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecipeRow } from "@/features/recipes/queries";
import { MenuGrid } from "./menu-grid";

const saveRecipe = vi.fn<(input: unknown) => Promise<{ ok: true; data: { id: string } }>>(async () => ({ ok: true, data: { id: "r-new" } }));
const generateShoppingListFromWeek = vi.fn(async () => ({
  ok: true as const,
  data: { matchedRecipes: ["Frango com arroz"], ingredientsAdded: 2, addedToShoppingList: true, shoppingListId: "lista-1", missingDishes: [] },
}));
vi.mock("@/features/recipes/actions", () => ({
  saveRecipe: (input: unknown) => saveRecipe(input),
  generateShoppingListFromWeek: (input: unknown) => (generateShoppingListFromWeek as (i: unknown) => ReturnType<typeof generateShoppingListFromWeek>)(input),
}));
vi.mock("../actions", () => ({ setMealPlanCell: vi.fn(), copyPlanDay: vi.fn(), repeatWeek: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const frango: RecipeRow = { id: "r1", title: "Frango com arroz", servings: 2, ingredients: [{ qty: 300, unit: "g", name: "frango" }, { qty: 200, unit: "g", name: "arroz" }] };
const plan = { MO: { almoco: "frango com arroz", jantar: "Omelete" } };

describe("MenuGrid (cardápio)", () => {
  it("explica o caminho e diz quanto da semana já vira lista de compras", () => {
    render(<MenuGrid weekStart="2026-09-28" plan={plan} recipes={[frango]} />);
    expect(screen.getByText("Como vira lista de compras")).toBeTruthy();
    expect(screen.getByText("1 de 2 pratos têm ingredientes e entra na lista.")).toBeTruthy();
    expect(screen.getByText("Sem ingredientes ainda: Omelete.")).toBeTruthy();
    const segunda = screen.getByRole("heading", { name: /^Segunda/ }).closest("section")!;
    // Prato com receita (maiúscula diferente): mostra que entra; sem receita: oferece "+ Ingredientes".
    expect(within(segunda).getByText(/2 ingredientes — entra na lista de compras/)).toBeTruthy();
    expect(within(segunda).getByRole("button", { name: "+ Ingredientes (pra lista de compras)" })).toBeTruthy();
  });

  it("“+ Ingredientes” cria a receita do prato ali mesmo, aceitando “2 ovos” e “sal a gosto”", async () => {
    render(<MenuGrid weekStart="2026-09-28" plan={plan} recipes={[frango]} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Ingredientes (pra lista de compras)" }));
    fireEvent.change(screen.getByLabelText("Ingredientes de Omelete"), { target: { value: "3 ovos\nsal a gosto" } });
    expect(screen.getByText("Vai pra lista de compras assim: 3 ovos · sal a gosto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Salvar ingredientes" }));
    await waitFor(() => expect(saveRecipe).toHaveBeenCalledWith({ id: undefined, title: "Omelete", servings: 2, ingredientsText: "3 ovos\nsal a gosto" }));
    await waitFor(() => expect(screen.getByText("2 de 2 pratos têm ingredientes e entram na lista.")).toBeTruthy());
  });

  it("gerar lista: sem prato com ingrediente o botão fica desligado; com, mostra o link da lista", async () => {
    const { unmount } = render(<MenuGrid weekStart="2026-09-28" plan={{ MO: { almoco: "Omelete" } }} recipes={[frango]} />);
    expect((screen.getByRole("button", { name: "Gerar lista de compras desta semana" }) as HTMLButtonElement).disabled).toBe(true);
    unmount();

    render(<MenuGrid weekStart="2026-09-28" plan={plan} recipes={[frango]} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerar lista de compras desta semana" }));
    await waitFor(() => expect(generateShoppingListFromWeek).toHaveBeenCalledWith({ weekStart: "2026-09-28" }));
    expect((await screen.findByRole("link", { name: "Abrir lista de compras →" })).getAttribute("href")).toBe("/itens/lista-1");
  });
});
