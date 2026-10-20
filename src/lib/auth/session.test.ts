import { describe, expect, it } from "vitest";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { resolveCurrentUser } from "./session";

type Profile = { id: string; full_name: string; role: "clinician" | "admin"; is_active: boolean } | null;

function fakeClient(claims: { sub?: string } | null, profile: Profile) {
  return {
    auth: { getClaims: async () => ({ data: claims ? { claims } : null, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }),
    }),
  } as unknown as ServerSupabaseClient;
}

describe("resolveCurrentUser", () => {
  it("returns null without verified claims", async () => {
    expect(await resolveCurrentUser(fakeClient(null, null))).toBeNull();
  });

  it("returns null for a deactivated profile", async () => {
    const profile = { id: "u1", full_name: "X", role: "clinician" as const, is_active: false };
    expect(await resolveCurrentUser(fakeClient({ sub: "u1" }, profile))).toBeNull();
  });

  it("returns the narrow user for an active profile", async () => {
    const profile = { id: "u1", full_name: "Dr X", role: "admin" as const, is_active: true };
    expect(await resolveCurrentUser(fakeClient({ sub: "u1" }, profile))).toEqual({
      id: "u1",
      fullName: "Dr X",
      role: "admin",
    });
  });
});
