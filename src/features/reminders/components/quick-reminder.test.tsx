// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickReminder } from "./quick-reminder";

const createReminderFromPhrase = vi.fn<(input: unknown) => Promise<{ ok: true; data: { id: string; description: string } }>>(async () => ({
  ok: true,
  data: { id: "r1", description: "amanhã às 09:00" },
}));
vi.mock("../actions", () => ({
  createReminderFromPhrase: (input: unknown) => createReminderFromPhrase(input),
  createReminder: vi.fn(),
  updateReminder: vi.fn(),
}));
vi.mock("@/features/contacts/actions", () => ({ searchContacts: vi.fn(async () => []) }));
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (msg: string) => toastSuccess(msg), error: vi.fn() } }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Terça, 29/09/2026, 10:30 em São Paulo.
  vi.setSystemTime(new Date("2026-09-29T13:30:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  createReminderFromPhrase.mockClear();
  toastSuccess.mockClear();
});

function openDialog() {
  render(<QuickReminder title="Renovar passaporte" timezone="America/Sao_Paulo" itemId="11111111-1111-4111-8111-111111111111" sourceType="item" />);
  fireEvent.click(screen.getByRole("button", { name: "Me lembrar" }));
  return screen.getByRole("textbox", { name: "Quando?" });
}

describe("QuickReminder", () => {
  it("mostra o que entendeu e cria o lembrete", async () => {
    const input = openDialog();
    fireEvent.change(input, { target: { value: "toda segunda às 8h" } });
    expect(screen.getByRole("status").textContent).toContain("toda segunda às 08:00 (começa seg 05/10)");

    fireEvent.click(screen.getByRole("button", { name: "Criar lembrete" }));
    await waitFor(() => expect(createReminderFromPhrase).toHaveBeenCalled());
    expect(createReminderFromPhrase).toHaveBeenCalledWith({
      phrase: "toda segunda às 8h",
      title: "Renovar passaporte",
      itemId: "11111111-1111-4111-8111-111111111111",
      sourceType: "item",
      sourceId: undefined,
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Combinado — te lembro amanhã às 09:00."));
  });

  it("não deixa criar quando não entende ou o horário já passou", () => {
    const input = openDialog();
    const create = () => screen.getByRole("button", { name: "Criar lembrete" }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "qualquer hora" } });
    expect(screen.getByRole("status").textContent).toContain("Não entendi quando");
    expect(create().disabled).toBe(true);

    fireEvent.change(input, { target: { value: "hoje às 8h" } });
    expect(screen.getByRole("status").textContent).toContain("já passou");
    expect(create().disabled).toBe(true);
  });

  it("sugestões preenchem a frase; assunto escrito aparece na prévia", () => {
    const input = openDialog() as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "amanhã 9h" }));
    expect(input.value).toBe("amanhã 9h");
    fireEvent.change(input, { target: { value: "levar os documentos amanhã 9h" } });
    expect(screen.getByRole("status").textContent).toContain("de levar os documentos");
  });

  it("variante de ícone (linhas de lista) tem nome acessível com o texto do item", () => {
    render(<QuickReminder variant="icon" title="Comprar vela" timezone="America/Sao_Paulo" />);
    expect(screen.getByRole("button", { name: "Me lembrar de Comprar vela" })).toBeTruthy();
  });
});
