// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
vi.mock("../actions", () => ({ capture: (...args: unknown[]) => capture(...args) }));
const createReminderFromPhrase = vi.fn();
vi.mock("@/features/reminders/actions", () => ({ createReminderFromPhrase: (...args: unknown[]) => createReminderFromPhrase(...args) }));
vi.mock("@/features/attachments/lib/upload-file", () => ({ uploadAttachment: vi.fn() }));
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
