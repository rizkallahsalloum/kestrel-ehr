import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ALLERGIES, IDENTITIES, MEDICATIONS, PATIENT_MEDICATIONS, PATIENTS } from "../../scripts/fixtures.ts";
import { summarizeDraftAlerts } from "@/features/chart/alerts";
import { loadPatientChart } from "@/features/chart/queries";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { clientFor } from "../helpers/supabase";

const asServerClient = (client: unknown) => client as ServerSupabaseClient;

describe("patient chart data access", () => {
  it("returns only active allergies and medications for a care-team member", async () => {
    const chart = await loadPatientChart(asServerClient(await clientFor("clinicianA")), PATIENTS.northOne);
    expect(chart).not.toBeNull();
    expect(chart!.allergies.map((a) => a.id)).toEqual([ALLERGIES.northOneAlphaActive]);
    expect(chart!.medications.map((m) => m.id)).toContain(PATIENT_MEDICATIONS.northOneTessalineActive);
    expect(chart!.medications.map((m) => m.id)).not.toContain(PATIENT_MEDICATIONS.northOneCalvexaStopped);
  });

  it("returns null for another team's patient", async () => {
    expect(await loadPatientChart(asServerClient(await clientFor("clinicianB")), PATIENTS.northOne)).toBeNull();
  });

  it("records the chart view in the audit log", async () => {
    await loadPatientChart(asServerClient(await clientFor("clinicianA")), PATIENTS.northTwo);
    const admin = await clientFor("admin");
    const { data } = await admin.rpc("admin_list_audit_events", { p_limit: 20 });
    expect(data?.some((e) => e.action === "patient_chart.viewed" && e.entity_id === PATIENTS.northTwo)).toBe(true);
  });

  it("loads unresolved alerts on evaluated drafts for the alert slot", async () => {
    const client = await clientFor("clinicianA");
    const { data: draft, error } = await client
      .from("prescriptions")
      .insert({
        patient_id: PATIENTS.northOne,
        medication_id: MEDICATIONS.zentoril,
        prescriber_id: IDENTITIES.clinicianA.id,
        dose_amount: 10,
        dose_unit: "mg",
        route: "oral",
        frequency: "once_daily",
        quantity: 30,
        refills: 0,
        start_date: new Date().toISOString().slice(0, 10),
        idempotency_key: randomUUID(),
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    await client.rpc("evaluate_prescription_safety", { p_prescription_id: draft!.id });

    const chart = await loadPatientChart(asServerClient(client), PATIENTS.northOne);
    const summary = summarizeDraftAlerts(chart!.prescriptions, chart!.draftAlerts);
    expect(summary.find((s) => s.prescriptionId === draft!.id)).toMatchObject({ blocking: 1, advisoryPending: 0 });
  });
});
