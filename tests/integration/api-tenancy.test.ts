import { describe, expect, it } from "vitest";
import { IDENTITIES, PATIENTS, TEAMS } from "../../scripts/fixtures.ts";
import { anonClient, clientFor } from "../helpers/supabase";

// These tests go through Supabase Auth and the Data API with real JWTs, to
// confirm the API behaves like the role simulation in tests/db.

describe("Data API tenancy with real sessions", () => {
  it("returns only the clinician's team patients", async () => {
    const client = await clientFor("clinicianA");
    const { data, error } = await client.from("patients").select("id");
    expect(error).toBeNull();
    expect(data?.map((p) => p.id).sort()).toEqual([PATIENTS.northOne, PATIENTS.northThree, PATIENTS.northTwo].sort());
  });

  it("hides another team's patient", async () => {
    const client = await clientFor("clinicianB");
    const { data, error } = await client.from("patients").select("id").eq("id", PATIENTS.northOne);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("denies anonymous reads", async () => {
    const { data, error } = await anonClient().from("patients").select("id");
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501");
  });

  it("denies a patient reassignment attempt", async () => {
    const client = await clientFor("clinicianB");
    const { error } = await client.from("patients").update({ care_team_id: TEAMS.south }).eq("id", PATIENTS.northOne);
    expect(error?.code).toBe("42501");
  });

  it("denies clinicians the admin membership RPC", async () => {
    const client = await clientFor("clinicianA");
    const { error } = await client.rpc("admin_set_team_membership", {
      p_care_team_id: TEAMS.south,
      p_profile_id: IDENTITIES.clinicianA.id,
      p_is_member: true,
    });
    expect(error?.code).toBe("42501");
  });

  it("lets the admin read the audit log but nothing clinical", async () => {
    const admin = await clientFor("admin");
    const audit = await admin.rpc("admin_list_audit_events", { p_limit: 5 });
    expect(audit.error).toBeNull();
    const allergies = await admin.from("allergies").select("id");
    expect(allergies.data).toEqual([]);
    const prescriptions = await admin.from("prescriptions").select("id");
    expect(prescriptions.data).toEqual([]);
  });

  it("does not expose the private audit table through the API", async () => {
    const client = await clientFor("admin");
    const { error } = await client.schema("private" as never).from("audit_logs").select("id");
    expect(error).not.toBeNull();
  });

  it("gives an inactive clinician no patient access", async () => {
    const client = await clientFor("inactive");
    const { data } = await client.from("patients").select("id");
    expect(data).toEqual([]);
  });
});
