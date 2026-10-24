import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { DiagnosisChange } from "../actions";

vi.mock("../actions", () => ({ setDiagnosisStatus: vi.fn(), updateDiagnosisDescription: vi.fn() }));

const actions = await import("../actions");
const { DiagnosisRowActions } = await import("./diagnosis-row-actions");

const setStatus = vi.mocked(actions.setDiagnosisStatus);
const updateDescription = vi.mocked(actions.updateDiagnosisDescription);

const ID = "00000000-0000-4000-8000-000000000501";
const ACTIVE = { id: ID, code: "I10", description: "Essential (primary) hypertension", status: "active", version: 2 } as const;

function deferred() {
  let resolve!: (value: ActionResult<DiagnosisChange>) => void;
  const promise = new Promise<ActionResult<DiagnosisChange>>((r) => (resolve = r));
  return { promise, resolve };
}

const button = (name: RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
const descriptionInput = () => screen.getByRole("textbox", { name: /Description/ }) as HTMLInputElement;

let frames: FrameRequestCallback[] = [];

/** Runs queued animation frames, as the browser would after React commits. */
function flushFrames() {
  const queued = frames;
  frames = [];
  act(() => queued.forEach((callback) => callback(0)));
}

describe("DiagnosisRowActions", () => {
  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("names each action after the diagnosis", () => {
    render(<DiagnosisRowActions target={ACTIVE} />);
    expect(button(/^Resolve\s*I10 Essential \(primary\) hypertension$/)).toBeTruthy();
    expect(button(/^Edit\s*I10 Essential \(primary\) hypertension$/)).toBeTruthy();
  });

  it("resolves with the expected version, disables the actions while pending, and confirms only after success", async () => {
    const pending = deferred();
    setStatus.mockReturnValueOnce(pending.promise);
    render(<DiagnosisRowActions target={ACTIVE} />);

    await act(async () => fireEvent.click(button(/^Resolve/)));
    expect(setStatus).toHaveBeenCalledWith({ diagnosisId: ID, status: "resolved", expectedVersion: 2 });
    expect(button(/^Resolve/).disabled).toBe(true);
    expect(button(/^Edit/).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("");

    await act(async () => pending.resolve(ok({ id: ID, status: "resolved", version: 3 })));
    expect(screen.getByRole("status").textContent).toBe("Diagnosis resolved.");
    expect(button(/^Resolve/).disabled).toBe(false);
  });

  it("reopens a resolved diagnosis", async () => {
    setStatus.mockResolvedValueOnce(ok({ id: ID, status: "active", version: 4 }));
    render(<DiagnosisRowActions target={{ ...ACTIVE, status: "resolved", version: 3 }} />);

    await act(async () => fireEvent.click(button(/^Reopen/)));
    expect(setStatus).toHaveBeenCalledWith({ diagnosisId: ID, status: "active", expectedVersion: 3 });
    expect(screen.getByRole("status").textContent).toBe("Diagnosis reopened.");
  });

  it("shows a version conflict next to the row and claims nothing", async () => {
    setStatus.mockResolvedValueOnce(
      fail("CONFLICT", "This diagnosis changed since you opened it. Reload and review it again."),
    );
    render(<DiagnosisRowActions target={ACTIVE} />);

    await act(async () => fireEvent.click(button(/^Resolve/)));
    expect(screen.getByText("This diagnosis changed since you opened it. Reload and review it again.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows a permission failure without changing the row", async () => {
    setStatus.mockResolvedValueOnce(fail("FORBIDDEN", "You are not allowed to perform this action."));
    render(<DiagnosisRowActions target={ACTIVE} />);

    await act(async () => fireEvent.click(button(/^Resolve/)));
    expect(screen.getByText("You are not allowed to perform this action.")).toBeTruthy();
    expect(button(/^Resolve/)).toBeTruthy();
  });

  it("edit: Save stays disabled until the text changes, and Unsaved changes shows while it differs", () => {
    render(<DiagnosisRowActions target={ACTIVE} />);
    fireEvent.click(button(/^Edit/));

    expect(descriptionInput().value).toBe(ACTIVE.description);
    expect(button(/^Save description$/).disabled).toBe(true);
    expect(screen.queryByText("Unsaved changes")).toBeNull();

    fireEvent.change(descriptionInput(), { target: { value: `${ACTIVE.description}, edited` } });
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect(button(/^Save description$/).disabled).toBe(false);

    fireEvent.change(descriptionInput(), { target: { value: `  ${ACTIVE.description}  ` } });
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    expect(button(/^Save description$/).disabled).toBe(true);
  });

  it("edit: saves with the expected version, closes the editor and returns focus to Edit", async () => {
    updateDescription.mockResolvedValueOnce(ok({ id: ID, status: "active", version: 3 }));
    render(<DiagnosisRowActions target={ACTIVE} />);
    fireEvent.click(button(/^Edit/));
    fireEvent.change(descriptionInput(), { target: { value: "Hypertension (synthetic edit)" } });

    await act(async () => fireEvent.click(button(/^Save description$/)));
    expect(updateDescription).toHaveBeenCalledWith({
      diagnosisId: ID,
      description: "Hypertension (synthetic edit)",
      expectedVersion: 2,
    });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Description saved.");
    flushFrames();
    expect(document.activeElement).toBe(button(/^Edit/));
  });

  it("edit: keeps the editor and the typed text open on a validation error", async () => {
    updateDescription.mockResolvedValueOnce(fail("VALIDATION", undefined, { description: ["Enter a description."] }));
    render(<DiagnosisRowActions target={ACTIVE} />);
    fireEvent.click(button(/^Edit/));
    fireEvent.change(descriptionInput(), { target: { value: "   " } });

    await act(async () => fireEvent.click(button(/^Save description$/)));
    expect(screen.getByText("Enter a description.")).toBeTruthy();
    expect(descriptionInput().value).toBe("   ");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("edit: Cancel discards the text without saving and returns focus to Edit", () => {
    render(<DiagnosisRowActions target={ACTIVE} />);
    fireEvent.click(button(/^Edit/));
    fireEvent.change(descriptionInput(), { target: { value: "Discarded synthetic text" } });

    fireEvent.click(button(/^Cancel$/));
    expect(updateDescription).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    flushFrames();
    expect(document.activeElement).toBe(button(/^Edit/));

    fireEvent.click(button(/^Edit/));
    expect(descriptionInput().value).toBe(ACTIVE.description);
  });
});
