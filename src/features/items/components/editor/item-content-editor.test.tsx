// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveEditor } from "./active-editor";
import { ItemContentEditor } from "./item-content-editor";

const updateItemContent = vi.fn<(itemId: string, knownUpdatedAt: string, content: unknown) => Promise<{ ok: true; data: { updatedAt: string } }>>(async () => ({
  ok: true,
  data: { updatedAt: "t2" },
}));
vi.mock("../../actions", () => ({ updateItemContent: (itemId: string, knownUpdatedAt: string, content: unknown) => updateItemContent(itemId, knownUpdatedAt, content) }));
vi.mock("@/features/attachments/lib/upload-file", () => ({ uploadAttachment: vi.fn() }));

afterEach(() => {
  cleanup();
  updateItemContent.mockClear();
});

describe("ItemContentEditor", () => {
  it("não perde o salvamento agendado quando a página recria o editor", async () => {
    const view = render(<ItemContentEditor itemId="item-9" spaceId={null} initialContent={null} updatedAt="t1" onSaved={vi.fn()} />);
    await waitFor(() => expect(getActiveEditor("item-9")).not.toBeNull());

    act(() => {
      getActiveEditor("item-9")!.commands.insertContent("print colado");
    });
    // o editor sai antes do autosave (800 ms) disparar — como quando a página é recriada
    view.unmount();

    await waitFor(() => expect(updateItemContent).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(updateItemContent.mock.calls[0]![2])).toContain("print colado");
  });
});
