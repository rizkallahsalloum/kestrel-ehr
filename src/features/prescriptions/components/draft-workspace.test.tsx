import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Prescription, PrescriptionAlert } from "@/types/domain";
import { savedDraftValues } from "../form-values";
import { todayUtc } from "../schemas";

vi.mock("../actions", () => ({
  createDraftFormAction: vi.fn(),
  updateDraftFormAction: vi.fn(),
  acknowledgeFormAction: vi.fn(),
  evaluateFormAction: vi.fn(),
  signFormAction: vi.fn(),
  cancelFormAction: vi.fn(),
}));

const { DraftWorkspace } = await import("./draft-workspace");

const MEDICATION = { id: "3e000000-0000-4000-8000-000000000002", name: "Calvexa", strength: "250 mg", form: "capsule", drug_class_code: "DEMO-BETA" };

const RX: Prescription = {
  id: "22222222-2222-4222-8222-222222222222",
  patient_id: "11111111-1111-4111-8111-111111111111",
  medication_id: MEDICATION.id,
  prescriber_id: "33333333-3333-4333-8333-333333333333",
  dose_amount: 1,
  dose_unit: "capsule",
  route: "oral",
  frequency: "twice_daily",
  quantity: 28,
  refills: 1,
  duration_days: null,
  start_date: todayUtc(),
  instructions: null,
  status: "draft",
  version: 2,
  idempotency_key: "44444444-4444-4444-8444-444444444444",
  last_evaluated_version: 2,
  signed_by: null,
  signed_at: null,
  cancelled_by: null,
  cancelled_at: null,
  cancel_reason: null,
  created_at: "2026-10-19T08:00:00Z",
  updated_at: "2026-10-19T08:00:00Z",
  medication: MEDICATION,
};

const ADVISORY: PrescriptionAlert = {
  id: "55555555-5555-4555-8555-555555555555",
  severity: "advisory",
  message: "DEMO RULE: demo classes Beta and Gamma flagged together. Illustrative only, not clinical guidance.",
  prescription_version: 2,
  resolved_at: null,
  allergy_id: null,
  patient_medication_id: null,
  decision: null,
};

function renderWorkspace(alerts: PrescriptionAlert[] = []) {
  render(
    <DraftWorkspace
      mode="edit"
      saved={{ prescription: RX, alerts, prescriberName: "Dr. Demo Clinician" }}
      patientId={RX.patient_id}
      patientName="Testcase, Rowan"
      medications={[MEDICATION]}
      initialValues={savedDraftValues(RX)}
      context={null}
    />,
  );
}

const signButton = () => screen.getByTestId("sign-button");

/** Text of the element(s) a control names in `aria-describedby`; also asserts they are rendered. */
function description(element: HTMLElement): string {
  const ids = element.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids
    .map((id) => {
      const target = document.getElementById(id)!;
      return target.getAttribute("aria-label") ?? target.textContent;
    })
    .join(" ");
}

describe("DraftWorkspace", () => {
  it("shows the saved version and enables signing once the review is confirmed", () => {
    renderWorkspace();
    expect(screen.getByText("Take 1 capsule by mouth twice daily.", { selector: "dd [data-private-value]" })).toBeTruthy();
    expect(signButton()).toHaveProperty("disabled", true);
    expect(description(signButton())).toBe("Tick the attestation above to confirm your review.");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(signButton().textContent).toBe("Sign prescription (simulated)");
    expect(signButton()).toHaveProperty("disabled", false);
    expect(signButton().getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByRole("list", { name: "Signing prerequisites" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save draft" })).toHaveProperty("disabled", true);
  });

  it("unsaved edits block signing, the safety check and acknowledgements until saved", () => {
    renderWorkspace([ADVISORY]);
    fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: "30" } });

    expect(screen.getByText("Unsaved changes. Save the draft to re-run the safety check.")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(signButton()).toHaveProperty("disabled", true);
    expect(signButton().textContent).toBe("Save your changes to sign");
    expect(description(signButton())).toContain("Save your changes: signing uses the saved version.");
    expect(description(signButton())).toContain("advisory demo alert must be acknowledged");

    const evaluate = screen.getByRole("button", { name: "Run safety check" });
    expect(evaluate).toHaveProperty("disabled", true);
    expect(description(evaluate)).toBe("Save your changes first: the safety check runs on the saved version.");

    const acknowledge = screen.getByRole("button", { name: "Acknowledge advisory alert" });
    expect(acknowledge).toHaveProperty("disabled", true);
    expect(description(acknowledge)).toBe("Save your changes first: acknowledgements belong to the saved version.");

    expect(screen.getByRole("button", { name: "Save draft" })).toHaveProperty("disabled", false);

    // The review still summarizes the saved version, not the edited form.
    expect(screen.getByText("28 dispensed, 1 refill")).toBeTruthy();
  });

  it("leaves the safety check and Acknowledge enabled, with no reason, when nothing is unsaved", () => {
    renderWorkspace([ADVISORY]);
    for (const name of ["Run safety check", "Acknowledge advisory alert"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveProperty("disabled", false);
      expect(button.getAttribute("aria-describedby")).toBeNull();
    }
  });

  it("updates the label preview line as the directions change", () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Dose amount"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "at_bedtime" } });
    expect(document.getElementById("rx-label-preview")?.textContent).toBe("Label preview: Take 2 capsules by mouth at bedtime.");
  });
});
