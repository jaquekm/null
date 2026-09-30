import { describe, expect, it } from "vitest";
import { applySpokenPunctuation, dictationErrorMessage, getSpeechRecognition, joinDictation } from "./dictation";

describe("applySpokenPunctuation", () => {
  it.each([
    ["comprar pão vírgula leite e ovos ponto final", "comprar pão, leite e ovos."],
    ["tudo certo ponto de interrogação", "tudo certo?"],
    ["lista de compras nova linha arroz", "lista de compras\narroz"],
    ["reunião dois pontos pauta", "reunião: pauta"],
    ["ponto de ônibus", "ponto de ônibus"],
  ])("%s → %j", (spoken, text) => {
    expect(applySpokenPunctuation(spoken)).toBe(text);
  });
});

describe("joinDictation", () => {
  it("campo vazio: começa com maiúscula", () => {
    expect(joinDictation("", "ligar pro dentista")).toBe("Ligar pro dentista");
  });

  it("continua a frase com espaço", () => {
    expect(joinDictation("Ligar pro dentista", "amanhã às 9h")).toBe("Ligar pro dentista amanhã às 9h");
    expect(joinDictation("Ligar pro dentista ", "amanhã")).toBe("Ligar pro dentista amanhã");
  });

  it("depois de fim de frase ou quebra de linha, maiúscula", () => {
    expect(joinDictation("Comprar pão.", "depois ligar")).toBe("Comprar pão. Depois ligar");
    expect(joinDictation("Mercado\n", "arroz")).toBe("Mercado\nArroz");
  });

  it("pontuação falada gruda no texto anterior", () => {
    expect(joinDictation("Comprar pão", "vírgula leite")).toBe("Comprar pão, leite");
  });

  it("trecho vazio não muda nada", () => {
    expect(joinDictation("Oi", "   ")).toBe("Oi");
  });

  it("não quebra o 'me lembra de' da 9.4", () => {
    expect(joinDictation("", "me lembra de pagar a luz amanhã às 9h")).toBe("Me lembra de pagar a luz amanhã às 9h");
  });
});

describe("getSpeechRecognition", () => {
  it("usa o padrão, senão o prefixado do Chrome/Safari", () => {
    class Std {}
    class Webkit {}
    expect(getSpeechRecognition({ SpeechRecognition: Std, webkitSpeechRecognition: Webkit })).toBe(Std);
    expect(getSpeechRecognition({ webkitSpeechRecognition: Webkit })).toBe(Webkit);
    expect(getSpeechRecognition({})).toBeNull();
    expect(getSpeechRecognition(undefined)).toBeNull();
  });
});

describe("dictationErrorMessage", () => {
  it("avisa permissão e falta de rede; silêncio não", () => {
    expect(dictationErrorMessage("not-allowed")).toContain("permissão");
    expect(dictationErrorMessage("network")).toContain("internet");
    expect(dictationErrorMessage("no-speech")).toBeNull();
    expect(dictationErrorMessage("aborted")).toBeNull();
    expect(dictationErrorMessage("xyz")).toContain("parou");
  });
});
