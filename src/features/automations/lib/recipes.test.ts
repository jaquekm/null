import { describe, expect, it } from "vitest";
import { reminderRuleInputSchema } from "@/features/reminders/schemas";
import { automationInputSchema, type AutomationAction } from "../schemas";
import { getRecipe, RECIPE_KEYS, RECIPES, recipeStates, withNotifyChannel, type RecipeAutomationRow, type RecipeRuleRow } from "./recipes";

const TZ = "America/Sao_Paulo";
const NOW = new Date("2026-09-30T13:00:00Z");
const noAlert = { ruleId: null, minutesBefore: null, channel: "push" as const };

function rule(overrides: Partial<RecipeRuleRow>): RecipeRuleRow {
  return { id: "r1", kind: "bill_due", recipient_type: "me", channel: "push", enabled: true, config: {}, created_at: "2026-01-01T00:00:00Z", ...overrides };
}

function automation(overrides: Partial<RecipeAutomationRow>): RecipeAutomationRow {
  return { id: "a1", enabled: true, pack_key: null, actions: [], created_at: "2026-01-01T00:00:00Z", ...overrides };
}

describe("RECIPES", () => {
  it("uma receita por chave, todas com frase", () => {
    expect(RECIPES.map((recipe) => recipe.key)).toEqual([...RECIPE_KEYS]);
    for (const recipe of RECIPES) {
      expect(recipe.sentence(recipe.channels[0] ?? null).length, recipe.key).toBeGreaterThan(20);
    }
  });

  it("regras de lembrete das receitas passam no schema das regras", () => {
    for (const recipe of RECIPES) {
      if (recipe.engine !== "reminder_rule") continue;
      const parsed = reminderRuleInputSchema.safeParse({ ...recipe.rule, channel: recipe.channels[0] ?? "auto", enabled: true });
      expect(parsed.success, recipe.key).toBe(true);
    }
  });

  it("automações das receitas passam no schema do editor, em todos os canais", () => {
    for (const recipe of RECIPES) {
      if (recipe.engine !== "automation") continue;
      for (const channel of recipe.channels) {
        expect(automationInputSchema.safeParse(recipe.build(channel, NOW, TZ)).success, `${recipe.key}/${channel}`).toBe(true);
      }
    }
  });

  it("frase muda com o canal", () => {
    const recipe = getRecipe("conta-a-pagar")!;
    expect(recipe.sentence("whatsapp")).toBe("Quando uma conta a pagar vencer amanhã, me avisar no WhatsApp — e de novo no dia");
    expect(recipe.sentence("push")).toContain("por notificação");
  });

  it("aviso de evento usa o tempo configurado na Agenda", () => {
    const recipe = getRecipe("aviso-evento")!;
    expect(recipe.sentence("push")).toBe("30 minutos antes de cada compromisso da agenda, me avisar por notificação");
    expect(recipe.sentence("whatsapp", { active: true, channel: "whatsapp", sourceId: "r", minutesBefore: 60 })).toBe(
      "1 hora antes de cada compromisso da agenda, me avisar no WhatsApp",
    );
  });

  it("revisão semanal: horário na primeira sexta futura, com o canal escolhido", () => {
    const recipe = getRecipe("revisao-semanal")!;
    if (recipe.engine !== "automation") throw new Error("engine");
    const built = recipe.build("whatsapp", NOW, TZ);
    expect(built.trigger).toEqual({ type: "schedule", rrule: "DTSTART:20261002T170000Z\nRRULE:FREQ=WEEKLY;BYDAY=FR", timezone: TZ });
    expect(built.actions[0]).toMatchObject({ type: "notify_me", channel: "whatsapp" });
    expect(recipe.build("push", NOW, TZ).actions[0]).not.toHaveProperty("channel");
  });

  it("chave desconhecida → null", () => {
    expect(getRecipe("nao-existe")).toBeNull();
  });
});

describe("recipeStates", () => {
  it("nada no banco: tudo desligado, canal padrão da receita", () => {
    const states = recipeStates({ rules: [], automations: [], eventAlert: noAlert });
    expect(states["conta-a-pagar"]).toEqual({ active: false, channel: "push", sourceId: null });
    expect(states["cobrar-conta-a-receber"].channel).toBeNull();
    expect(states["aviso-evento"]).toMatchObject({ active: false, sourceId: null });
  });

  it("reconhece a regra pela marca `config.recipe`, não pelo tipo", () => {
    const states = recipeStates({
      rules: [
        rule({ id: "manual", config: { daysBefore: 3 } }),
        rule({ id: "receita", channel: "whatsapp", config: { daysBefore: 1, recipe: "conta-a-pagar" } }),
      ],
      automations: [],
      eventAlert: noAlert,
    });
    expect(states["conta-a-pagar"]).toEqual({ active: true, channel: "whatsapp", sourceId: "receita" });
  });

  it("regra desligada = receita desligada, mas lembra o canal", () => {
    const states = recipeStates({ rules: [rule({ enabled: false, channel: "email", config: { recipe: "minha-parte-divisao" } })], automations: [], eventAlert: noAlert });
    expect(states["minha-parte-divisao"]).toEqual({ active: false, channel: "email", sourceId: "r1" });
  });

  it("canal fora dos permitidos cai no primeiro permitido", () => {
    const states = recipeStates({ rules: [rule({ kind: "birthday", channel: "whatsapp", config: { recipe: "aniversarios" } })], automations: [], eventAlert: noAlert });
    expect(states.aniversarios.channel).toBe("push");
  });

  it("aviso de evento vem da regra da Agenda", () => {
    const states = recipeStates({ rules: [], automations: [], eventAlert: { ruleId: "ev", minutesBefore: 60, channel: "whatsapp" } });
    expect(states["aviso-evento"]).toEqual({ active: true, channel: "whatsapp", sourceId: "ev", minutesBefore: 60 });
  });

  it("automação da receita pelo pack_key, canal lido do 'me avisar'", () => {
    const states = recipeStates({
      rules: [],
      automations: [
        automation({ id: "outra", pack_key: "gtd" }),
        automation({ id: "urg", pack_key: "recipe:tag-urgente", actions: [{ type: "notify_me", title: "x", body: "y", channel: "whatsapp" }] }),
      ],
      eventAlert: noAlert,
    });
    expect(states["tag-urgente"]).toEqual({ active: true, channel: "whatsapp", sourceId: "urg" });
    expect(states["revisao-semanal"]).toEqual({ active: false, channel: "push", sourceId: null });
  });
});

describe("withNotifyChannel", () => {
  it("troca só o canal do 'me avisar', mantendo as outras ações", () => {
    const actions: AutomationAction[] = [
      { type: "add_tag", tag: "x" },
      { type: "notify_me", title: "t", body: "b", channel: "whatsapp" },
    ];
    expect(withNotifyChannel(actions, "push")).toEqual([
      { type: "add_tag", tag: "x" },
      { type: "notify_me", title: "t", body: "b" },
    ]);
    expect(withNotifyChannel(actions, "whatsapp")[1]).toEqual({ type: "notify_me", title: "t", body: "b", channel: "whatsapp" });
  });
});
