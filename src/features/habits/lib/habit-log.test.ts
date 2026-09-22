import { describe, expect, it } from "vitest";
import { countLoggedInRange, isHabitLogged, toggleHabitDay } from "./habit-log";

describe("isHabitLogged", () => {
  it("dia marcado retorna true", () => {
    expect(isHabitLogged({ "2026-09-22": true }, "2026-09-22")).toBe(true);
  });
  it("dia ausente retorna false", () => {
    expect(isHabitLogged({ "2026-09-22": true }, "2026-09-21")).toBe(false);
  });
  it("log ausente retorna false", () => {
    expect(isHabitLogged(undefined, "2026-09-22")).toBe(false);
  });
});

describe("toggleHabitDay", () => {
  it("marca um dia desmarcado", () => {
    expect(toggleHabitDay({}, "2026-09-22")).toEqual({ "2026-09-22": true });
  });
  it("desmarca um dia marcado, removendo a chave (não deixa false)", () => {
    expect(toggleHabitDay({ "2026-09-22": true }, "2026-09-22")).toEqual({});
  });
  it("não mexe nos outros dias", () => {
    expect(toggleHabitDay({ "2026-09-21": true }, "2026-09-22")).toEqual({ "2026-09-21": true, "2026-09-22": true });
  });
  it("log undefined vira objeto novo", () => {
    expect(toggleHabitDay(undefined, "2026-09-22")).toEqual({ "2026-09-22": true });
  });
});

describe("countLoggedInRange", () => {
  it("conta só os dias marcados dentro do intervalo (inclusive)", () => {
    const log = { "2026-09-15": true, "2026-09-20": true, "2026-09-25": true };
    expect(countLoggedInRange(log, "2026-09-16", "2026-09-22")).toBe(1);
  });
  it("intervalo inclui as bordas", () => {
    const log = { "2026-09-15": true, "2026-09-22": true };
    expect(countLoggedInRange(log, "2026-09-15", "2026-09-22")).toBe(2);
  });
  it("log undefined conta 0", () => {
    expect(countLoggedInRange(undefined, "2026-09-15", "2026-09-22")).toBe(0);
  });
});
