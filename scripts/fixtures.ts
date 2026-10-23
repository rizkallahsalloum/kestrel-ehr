/**
 * Deterministic synthetic fixtures shared by the seed script and the tests.
 * Every identifier here must match supabase/seed/synthetic.sql.
 */

export type IdentityKey = "clinicianA" | "clinicianA2" | "clinicianB" | "admin" | "inactive";

export type Identity = {
  id: string;
  email: string;
  fullName: string;
  role: "clinician" | "admin";
  isActive: boolean;
};

export const IDENTITIES: Record<IdentityKey, Identity> = {
  clinicianA: {
    id: "a0000000-0000-4000-8000-000000000001",
    email: "clinician.a@kestrel.example",
    fullName: "Dr. Avery North (synthetic)",
    role: "clinician",
    isActive: true,
  },
  clinicianA2: {
    id: "a0000000-0000-4000-8000-000000000002",
    email: "clinician.a2@kestrel.example",
    fullName: "Dr. Alex Norwood (synthetic)",
    role: "clinician",
    isActive: true,
  },
  clinicianB: {
    id: "b0000000-0000-4000-8000-000000000001",
    email: "clinician.b@kestrel.example",
    fullName: "Dr. Blair South (synthetic)",
    role: "clinician",
    isActive: true,
  },
  admin: {
    id: "ad000000-0000-4000-8000-000000000001",
    email: "admin@kestrel.example",
    fullName: "Admin Operator (synthetic)",
    role: "admin",
    isActive: true,
  },
  inactive: {
    id: "c0000000-0000-4000-8000-000000000001",
    email: "inactive@kestrel.example",
    fullName: "Dr. Former Member (synthetic)",
    role: "clinician",
    isActive: false,
  },
};

export const TEAMS = {
  north: "7a000000-0000-4000-8000-000000000001",
  south: "7b000000-0000-4000-8000-000000000001",
} as const;

export const PATIENTS = {
  /** Team North. Active allergy to DEMO-ALPHA, active Tessaline (DEMO-DELTA). */
  northOne: "9a000000-0000-4000-8000-000000000001",
  /** Team North. No allergies, active Morivane (DEMO-GAMMA). */
  northTwo: "9a000000-0000-4000-8000-000000000002",
  /** Team North. No allergies or medications. */
  northThree: "9a000000-0000-4000-8000-000000000003",
  /** Team South. */
  southOne: "9b000000-0000-4000-8000-000000000001",
  southTwo: "9b000000-0000-4000-8000-000000000002",
} as const;

export const MEDICATIONS = {
  zentoril: "3e000000-0000-4000-8000-000000000001", // DEMO-ALPHA
  calvexa: "3e000000-0000-4000-8000-000000000002", // DEMO-BETA
  morivane: "3e000000-0000-4000-8000-000000000003", // DEMO-GAMMA
  tessaline: "3e000000-0000-4000-8000-000000000004", // DEMO-DELTA
  ploxidrin: "3e000000-0000-4000-8000-000000000005", // DEMO-BETA
  retiredDemo: "3e000000-0000-4000-8000-000000000006", // inactive catalog entry
} as const;

export const ALLERGIES = {
  northOneAlphaActive: "a1000000-0000-4000-8000-000000000001",
  northOneBetaInactive: "a1000000-0000-4000-8000-000000000002",
  southOneGammaActive: "a1000000-0000-4000-8000-000000000003",
} as const;

/** Idempotency keys of drafts the seed script creates through the app's path (as clinicianA). */
export const SEED_DRAFTS = {
  /** Zentoril (DEMO-ALPHA) for Rowan Testcase: blocked by her severe DEMO-ALPHA allergy. */
  northOneZentorilBlocking: "d5000000-0000-4000-8000-000000000001",
} as const;

/**
 * Idempotency keys of prescriptions the seed script signs through the app's path (as clinicianA),
 * so the chart has a signed prescription to renew. The e2e and integration resets keep these.
 */
export const SEED_SIGNED = {
  /** Ploxidrin (DEMO-BETA) for Rowan Testcase; her DEMO-BETA allergy is inactive. */
  northOnePloxidrin: "d5000000-0000-4000-8000-000000000002",
  /** Zentoril (DEMO-ALPHA) for Elliot Samplewood. */
  northTwoZentoril: "d5000000-0000-4000-8000-000000000003",
} as const;

export const DIAGNOSES = {
  northOneHypertension: "d1000000-0000-4000-8000-000000000001",
  northOneDiabetes: "d1000000-0000-4000-8000-000000000002",
  northOneLipids: "d1000000-0000-4000-8000-000000000003",
  northOneUriResolved: "d1000000-0000-4000-8000-000000000004",
  northTwoAsthma: "d1000000-0000-4000-8000-000000000006",
  southOneHypertension: "d1000000-0000-4000-8000-000000000010",
} as const;

export const PATIENT_MEDICATIONS = {
  northOneTessalineActive: "5d000000-0000-4000-8000-000000000001",
  northOneCalvexaStopped: "5d000000-0000-4000-8000-000000000002",
  northTwoMorivaneActive: "5d000000-0000-4000-8000-000000000003",
  southOneZentorilActive: "5d000000-0000-4000-8000-000000000004",
} as const;
