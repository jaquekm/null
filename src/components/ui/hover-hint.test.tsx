// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoverHint } from "./hover-hint";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup() {
  render(
    <HoverHint text="Cria uma cópia igual." delayMs={600}>
      <button type="button">Duplicar</button>
    </HoverHint>,
  );
  return screen.getByRole("button", { name: "Duplicar" });
}

describe("HoverHint", () => {
  it("só aparece depois do mouse ficar parado em cima do botão", () => {
    const button = setup();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(300));
    expect(screen.queryByRole("tooltip")).toBeNull(); // passou rápido: nada

    act(() => void vi.advanceTimersByTime(400));
    expect(screen.getByRole("tooltip").textContent).toBe("Cria uma cópia igual.");
    expect(button.getAttribute("aria-describedby")).toBe(screen.getByRole("tooltip").id);
  });

  it("não aparece se o mouse sai antes do tempo, e some ao sair", () => {
    const button = setup();
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(300));
    fireEvent.pointerLeave(button);
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(700));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.pointerLeave(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("some ao clicar e com Esc; e aparece também pelo foco do teclado", () => {
    const button = setup();
    fireEvent.focus(button);
    act(() => void vi.advanceTimersByTime(700));
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    act(() => void vi.advanceTimersByTime(700));
    fireEvent.pointerDown(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("toque não dispara a dica (não existe mouse parado no celular)", () => {
    const button = setup();
    fireEvent.pointerEnter(button, { pointerType: "touch" });
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
