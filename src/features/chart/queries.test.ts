import { describe, expect, it, vi } from "vitest";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { ChartAccessLogError, loadPatientChart } from "./queries";

const PATIENT_ID = "9a000000-0000-4000-8000-000000000001";

function fakeClient(rpcError: { code: string } | null) {
  const from = vi.fn(() => {
    throw new Error("clinical data must not be queried");
  });
  const rpc = vi.fn(async () => ({ data: null, error: rpcError }));
  return { client: { rpc, from } as unknown as ServerSupabaseClient, rpc, from };
}

describe("loadPatientChart audit fail-closed behavior", () => {
  it("does not read clinical data when the view cannot be logged", async () => {
    const { client, rpc, from } = fakeClient({ code: "XX000" });
    await expect(loadPatientChart(client, PATIENT_ID)).rejects.toBeInstanceOf(ChartAccessLogError);
    expect(rpc).toHaveBeenCalledWith("log_patient_access", { p_patient_id: PATIENT_ID });
    expect(from).not.toHaveBeenCalled();
  });

  it("treats a refused log (not on the care team) as not found", async () => {
    const { client, from } = fakeClient({ code: "42501" });
    await expect(loadPatientChart(client, PATIENT_ID)).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects malformed ids before touching the database", async () => {
    const { client, rpc } = fakeClient(null);
    await expect(loadPatientChart(client, "not-a-uuid")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
