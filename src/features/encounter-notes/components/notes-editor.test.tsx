import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { SavedNote } from "../actions";
import type { SaveNoteInput } from "../schemas";

vi.mock("../actions", () => ({ saveEncounterNote: vi.fn() }));

const { NotesEditor, NOTE_IDLE_MS, NOTE_MAX_WAIT_MS } = await import("./notes-editor");

const PATIENT = "00000000-0000-4000-8000-000000000101";
const NOTE = "00000000-0000-4000-8000-000000000601";

type Save = (input: SaveNoteInput) => Promise<ActionResult<SavedNote>>;

function deferred() {
  let resolve!: (value: ActionResult<SavedNote>) => void;
  const promise = new Promise<ActionResult<SavedNote>>((r) => (resolve = r));
  return { promise, resolve };
}

const textarea = () => screen.getByRole("textbox", { name: /Your note for today/ }) as HTMLTextAreaElement;
const state = () => document.querySelector("[data-save-state]")!.getAttribute("data-save-state");
const type = (value: string) => fireEvent.change(textarea(), { target: { value } });

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("NotesEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves after a pause in typing and shows Saved only after the server confirms", async () => {
    const pending = deferred();
    const save = vi.fn<Save>(() => pending.promise);
    render(<NotesEditor patientId={PATIENT} initial={null} save={save} />);
    expect(screen.getByText("No note for today yet")).toBeTruthy();

    type("Synthetic note");
    expect(state()).toBe("dirty");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    await advance(NOTE_IDLE_MS - 1);
    expect(save).not.toHaveBeenCalled();

    await advance(1);
    expect(save).toHaveBeenCalledWith({ patientId: PATIENT, noteId: null, expectedVersion: null, body: "Synthetic note" });
    expect(state()).toBe("saving");
    expect(screen.queryByText(/^Saved/)).toBeNull();

    await act(async () => pending.resolve(ok({ noteId: NOTE, version: 1, savedAt: "2026-10-22T14:32:00Z" })));
    expect(state()).toBe("clean");
    expect(screen.getByText(/Saved 14:32 UTC/)).toBeTruthy();
  });

  it("saves at least every ten seconds while typing continues, one save at a time", async () => {
    const save = vi.fn<Save>(async (input) => ok({ noteId: NOTE, version: (input.expectedVersion ?? 0) + 1, savedAt: "2026-10-22T14:32:00Z" }));
    render(<NotesEditor patientId={PATIENT} initial={null} save={save} />);

    for (let elapsed = 0; elapsed < NOTE_MAX_WAIT_MS; elapsed += 1000) {
      type(`Synthetic ${elapsed}`);
      await advance(1000);
    }
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].noteId).toBeNull();

    type("Synthetic later");
    await advance(NOTE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0]).toMatchObject({ noteId: NOTE, expectedVersion: 1, body: "Synthetic later" });
  });

  it("keeps Unsaved changes when text changed during a save, then saves it", async () => {
    const first = deferred();
    const save = vi
      .fn<Save>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(ok({ noteId: NOTE, version: 2, savedAt: "2026-10-22T14:33:00Z" }));
    render(<NotesEditor patientId={PATIENT} initial={null} save={save} />);

    type("First");
    await advance(NOTE_IDLE_MS);
    type("First and more");
    await act(async () => first.resolve(ok({ noteId: NOTE, version: 1, savedAt: "2026-10-22T14:32:00Z" })));
    expect(state()).toBe("dirty");

    await advance(NOTE_IDLE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0]).toMatchObject({ noteId: NOTE, expectedVersion: 1, body: "First and more" });
    expect(state()).toBe("clean");
  });

  it("does not create an empty note", async () => {
    const save = vi.fn<Save>();
    render(<NotesEditor patientId={PATIENT} initial={null} save={save} />);
    type("   ");
    await advance(NOTE_MAX_WAIT_MS);
    expect(save).not.toHaveBeenCalled();
  });

  it("stops autosave on a conflict and keeps the typed text", async () => {
    const save = vi.fn<Save>(async () => fail("CONFLICT", "This note changed in another tab or window. Copy your text, then reload."));
    render(
      <NotesEditor
        patientId={PATIENT}
        initial={{ noteId: NOTE, version: 3, body: "Saved text", savedAt: "2026-10-22T09:00:00Z" }}
        save={save}
      />,
    );
    expect(screen.getByText(/Saved 09:00 UTC/)).toBeTruthy();

    type("Saved text, edited");
    await advance(NOTE_IDLE_MS);
    expect(save).toHaveBeenCalledWith({ patientId: PATIENT, noteId: NOTE, expectedVersion: 3, body: "Saved text, edited" });
    expect(state()).toBe("conflict");
    expect(screen.getByRole("alert").textContent).toContain("Not saved.");
    expect(textarea().value).toBe("Saved text, edited");

    type("Saved text, edited again");
    await advance(NOTE_MAX_WAIT_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("offers a retry after a failed save and does not claim it saved", async () => {
    const save = vi
      .fn<Save>()
      .mockResolvedValueOnce(fail("INTERNAL", "Something went wrong. Please try again."))
      .mockResolvedValueOnce(ok({ noteId: NOTE, version: 1, savedAt: "2026-10-22T14:32:00Z" }));
    render(<NotesEditor patientId={PATIENT} initial={null} save={save} />);

    type("Synthetic");
    await advance(NOTE_IDLE_MS);
    expect(state()).toBe("error");
    expect(screen.queryByText(/^Saved/)).toBeNull();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry save" })));
    expect(save).toHaveBeenCalledTimes(2);
    expect(state()).toBe("clean");
  });
});
