// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MeetingPanel } from "./meeting-panel";

const createShareLink = vi.fn<(input: unknown) => Promise<{ ok: true; data: { url: string } }>>(async () => ({ ok: true, data: { url: "https://hub/p/r1" } }));
const createTasksFromActions = vi.fn<(itemId: string, tasks: unknown[]) => Promise<{ ok: true; data: { createdCount: number } }>>(async (_id, tasks) => ({
  ok: true,
  data: { createdCount: tasks.length },
}));
vi.mock("@/features/sharing/actions", () => ({ createShareLink: (input: unknown) => createShareLink(input) }));
vi.mock("@/features/transcripts/actions", () => ({ createTasksFromActions: (id: string, tasks: unknown[]) => createTasksFromActions(id, tasks) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  createShareLink.mockClear();
  createTasksFromActions.mockClear();
});

const participants = [
  { name: "Ana", phoneE164: "+5511999990000", email: "ana@x.com" },
  { name: "Bruno", phoneE164: null, email: null },
];

function renderPanel(nextSteps: string[] = ["Enviar proposta", "Ligar pro fornecedor"]) {
  render(
    <MeetingPanel itemId="m1" title="Kickoff" dateLabel="29/09" participants={participants} nextSteps={nextSteps} spaces={[]} defaultSpaceId={null} />,
  );
}

describe("MeetingPanel", () => {
  it("gera o link e oferece WhatsApp por participante e um e-mail pra quem tem e-mail", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Gerar link da reunião/ }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Ana/ })).toBeTruthy());
    expect(createShareLink).toHaveBeenCalledWith({ resourceId: "m1", permission: "view", validity: "90d" });
    expect(screen.getByRole("link", { name: /Ana/ }).getAttribute("href")).toContain("https://wa.me/5511999990000?text=");
    expect(decodeURIComponent(screen.getByRole("link", { name: /Ana/ }).getAttribute("href") ?? "")).toContain("“Kickoff” (29/09)");
    expect(screen.getByRole("link", { name: /E-mail pra todos/ }).getAttribute("href")).toMatch(/^mailto:ana@x\.com\?/);
  });

  it("próximos passos viram tarefas; lembrete só com prazo", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Criar 2 tarefas dos próximos passos" }));
    const dialog = screen.getByRole("dialog", { name: "Criar tarefas da reunião" });
    const reminders = within(dialog).getAllByRole("checkbox", { name: /Me lembrar no dia do prazo/ }) as HTMLInputElement[];
    expect(reminders.every((box) => box.disabled)).toBe(true);

    const [firstDate] = within(dialog).getAllByLabelText("Prazo") as HTMLInputElement[];
    fireEvent.change(firstDate!, { target: { value: "2026-10-05" } });
    fireEvent.change(within(dialog).getAllByLabelText("Responsável")[0]!, { target: { value: "Ana" } });
    fireEvent.click(within(dialog).getAllByRole("checkbox", { name: "Criar esta tarefa" })[1]!);
    fireEvent.click(within(dialog).getByRole("button", { name: "Criar 1 tarefa" }));

    await waitFor(() => expect(createTasksFromActions).toHaveBeenCalled());
    expect(createTasksFromActions.mock.calls[0]).toEqual([
      "m1",
      [{ descricao: "Enviar proposta", responsavel: "Ana", prazo: "2026-10-05", spaceId: null, lembrar: true }],
    ]);
  });

  it("sem próximos passos explica como fazer", () => {
    renderPanel([]);
    expect(screen.queryByRole("button", { name: /dos próximos passos/ })).toBeNull();
    expect(screen.getByText(/viram tarefas com responsável, prazo e lembrete/)).toBeTruthy();
  });
});
