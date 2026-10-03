// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
vi.mock("../actions", () => ({ capture: (...args: unknown[]) => capture(...args) }));
const createReminderFromPhrase = vi.fn();
vi.mock("@/features/reminders/actions", () => ({ createReminderFromPhrase: (...args: unknown[]) => createReminderFromPhrase(...args) }));
vi.mock("@/features/attachments/lib/upload-file", () => ({ uploadAttachment: vi.fn() }));
const createBillFromPhrase = vi.fn();
vi.mock("@/features/financas/actions", () => ({ createBillFromPhrase: (...args: unknown[]) => createBillFromPhrase(...args) }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const addQueuedCapture = vi.fn(async () => {});
vi.mock("../lib/offline-capture-db", () => ({
  addQueuedCapture: (...args: unknown[]) => addQueuedCapture(...(args as [])),
  countQueuedCaptures: async () => 0,
  OFFLINE_CAPTURES_EVENT: "jkode:offline-captures",
}));

const { CaptureForm } = await import("./capture-form");

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.last = this;
  }
  say(text: string, isFinal: boolean) {
    const result = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

beforeEach(() => {
  setOnline(true);
  capture.mockResolvedValue({ ok: true, data: { id: "item-1" } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe("CaptureForm — ditado (9.9)", () => {
  it("o microfone transcreve em pt-BR direto no campo", async () => {
    (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
    render(<CaptureForm spaces={[]} types={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Falar" }));
    const recognition = FakeRecognition.last!;
    expect(recognition.lang).toBe("pt-BR");
    expect(recognition.start).toHaveBeenCalled();

    act(() => recognition.say("me lembra de pagar a luz", false));
    expect(screen.getByText(/me lembra de pagar a luz/)).toBeTruthy(); // prévia do trecho em andamento

    act(() => recognition.say("me lembra de pagar a luz amanhã às 9h", true));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Me lembra de pagar a luz amanhã às 9h");
    expect(screen.getByRole("button", { name: "Criar lembrete" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Parar de ouvir" }));
    expect(recognition.stop).toHaveBeenCalled();
  });

  it("atalho 'Falar' já abre ouvindo", () => {
    (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
    render(<CaptureForm spaces={[]} types={[]} autoStartDictation />);
    expect(FakeRecognition.last?.start).toHaveBeenCalled();
  });

  it("navegador sem ditado: sem botão de microfone", () => {
    render(<CaptureForm spaces={[]} types={[]} />);
    expect(screen.queryByRole("button", { name: "Falar" })).toBeNull();
  });
});

describe("CaptureForm — sem internet (9.9)", () => {
  it("offline: guarda no aparelho em vez de chamar o servidor", async () => {
    setOnline(false);
    const onDone = vi.fn();
    render(<CaptureForm spaces={[]} types={[]} onDone={onDone} />);
    expect(screen.getByText(/Sem internet/)).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Comprar pilhas" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar no aparelho" }));

    await waitFor(() => expect(addQueuedCapture).toHaveBeenCalledWith({ text: "Comprar pilhas", spaceId: null, typeId: null }));
    expect(capture).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it("a rede cai no meio do envio: guarda em vez de perder", async () => {
    capture.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<CaptureForm spaces={[]} types={[]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ideia" } });
    fireEvent.click(screen.getByRole("button", { name: "Capturar" }));
    await waitFor(() => expect(addQueuedCapture).toHaveBeenCalledWith({ text: "Ideia", spaceId: null, typeId: null }));
  });
});

describe("CaptureForm — conta a pagar em frase", () => {
  it("“pagar … R$ … dia …” mostra a prévia e cria a conta a pagar", async () => {
    createBillFromPhrase.mockResolvedValue({ ok: true, data: { id: "b1", direction: "payable", description: "Pastéis ao clube Leo", amount: "60,00", dueOn: "2026-10-10", reminder: false } });
    render(<CaptureForm spaces={[]} types={[]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pagar os pastéis ao clube Leo R$ 60 dia 10" } });
    expect(screen.getByText(/Vira conta a pagar/)).toBeTruthy();
    expect(screen.getByText("R$ 60,00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Criar conta a pagar" }));
    await waitFor(() => expect(createBillFromPhrase).toHaveBeenCalledWith("Pagar os pastéis ao clube Leo R$ 60 dia 10"));
    expect(capture).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Conta a pagar criada: R$ 60,00, vence 10/10"), expect.anything()));
  });

  it("“Não, salvar como nota” captura como nota normal", async () => {
    render(<CaptureForm spaces={[]} types={[]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "pagar luz R$ 120 dia 10" } });
    fireEvent.click(screen.getByRole("button", { name: "Não, salvar como nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Capturar" }));
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(createBillFromPhrase).not.toHaveBeenCalled();
  });

  it("sem valor continua sendo nota (ou lembrete)", () => {
    render(<CaptureForm spaces={[]} types={[]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pagar os pasteis ao clube leo" } });
    expect(screen.queryByText(/Vira conta a pagar/)).toBeNull();
    expect(screen.getByRole("button", { name: "Capturar" })).toBeTruthy();
  });
});
