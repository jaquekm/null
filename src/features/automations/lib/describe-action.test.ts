import { describe, expect, it } from "vitest";
import { describeAction } from "./describe-action";

const ITEM = { title: "Oportunidade X", properties: { stage: "novo" } };
const TODAY = new Date("2026-09-22T12:00:00Z");

describe("describeAction", () => {
  it("set_property resolve template no valor", () => {
    expect(describeAction({ type: "set_property", field: "prazo", value: "{{today+7d}}" }, ITEM, TODAY)).toContain("2026-09-29");
  });

  it("create_item resolve template no título e menciona vínculo/subitem", () => {
    const text = describeAction(
      { type: "create_item", typeId: "t1", title: "Follow-up: {{title}}", properties: {}, linkToTrigger: true, parent: true },
      ITEM,
      TODAY,
    );
    expect(text).toContain("Follow-up: Oportunidade X");
    expect(text).toContain("vinculado a este item");
    expect(text).toContain("como subitem");
  });

  it("create_bill distingue payable/receivable", () => {
    expect(describeAction({ type: "create_bill", direction: "payable", amountField: "v", dueInDays: 5, description: "x" }, ITEM, TODAY)).toContain("pagar");
    expect(describeAction({ type: "create_bill", direction: "receivable", amountField: "v", dueInDays: 5, description: "x" }, ITEM, TODAY)).toContain("receber");
  });

  it("todas as ações produzem uma descrição não vazia", () => {
    const actions: Parameters<typeof describeAction>[0][] = [
      { type: "add_tag", tag: "x" },
      { type: "remove_tag", tag: "x" },
      { type: "move_to_space", spaceId: null },
      { type: "create_checklist", items: ["a"] },
      { type: "create_reminder", recipient: "me", offsetMinutes: 0, message: "oi" },
      { type: "notify_me", title: "t", body: "b" },
      { type: "create_review_cards" },
      { type: "call_webhook", url: "https://x.com" },
    ];
    for (const action of actions) {
      expect(describeAction(action, ITEM, TODAY).length).toBeGreaterThan(0);
    }
  });
});
