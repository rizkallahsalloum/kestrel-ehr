import type { DiagnosisItem } from "@/features/diagnoses/queries";
import type { EncounterNote, EncounterNotes } from "@/features/encounter-notes/queries";
import type { Hba1cPoint } from "@/features/labs/chart-scale";
import type { VitalReading } from "@/features/vitals/thresholds";

// Static synthetic clinical content for the chart specimen. Mirrors supabase/seed/synthetic.sql.

const RECORDER = { full_name: "Dr. Demo Clinician" };
const TEAMMATE = { full_name: "Dr. Demo Colleague" };

function diagnosis(
  n: number,
  icd10_code: string,
  description: string,
  recorded_on: string,
  resolved_on: string | null = null,
): DiagnosisItem {
  return {
    id: `00000000-0000-4000-8000-0000000005${String(n).padStart(2, "0")}`,
    icd10_code,
    description,
    status: resolved_on ? "resolved" : "active",
    recorded_on,
    resolved_on,
    version: 1,
    recorder: n % 2 === 0 ? TEAMMATE : RECORDER,
  };
}

const MONTHS = ["2026-05-12", "2026-06-12", "2026-07-12", "2026-08-12", "2026-09-12", "2026-10-12"];

function vitals(rows: [hr: number, sys: number, dia: number, spo2: number, temp: number][]): VitalReading[] {
  return rows.map(([heart_rate, systolic, diastolic, spo2, temperature_f], i) => ({
    recorded_at: `${MONTHS[i]}T09:00:00Z`,
    heart_rate,
    systolic,
    diastolic,
    spo2,
    temperature_f,
  }));
}

function note(n: number, body: string, note_date: string, author = TEAMMATE): EncounterNote {
  return {
    id: `00000000-0000-4000-8000-0000000006${String(n).padStart(2, "0")}`,
    author_id: `a0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    note_date,
    body,
    version: 1,
    saved_at: `${note_date}T10:30:00Z`,
    author,
  };
}

const NO_NOTES: EncounterNotes = { recent: [], ownToday: null };

export type ClinicalContent = {
  vitals: VitalReading[];
  hba1c: Hba1cPoint[];
  diagnoses: DiagnosisItem[];
  notes: EncounterNotes;
};

/** Case 1: diabetes, hypertension and hyperlipidemia; BP in the demo warning band. */
export const DIABETES_CASE: ClinicalContent = {
  vitals: vitals([
    [76, 142, 90, 98, 98.2],
    [80, 146, 91, 97, 98.6],
    [74, 150, 94, 98, 98.4],
    [79, 145, 92, 97, 98.5],
    [77, 147, 93, 98, 98.3],
    [78, 148, 92, 97, 98.4],
  ]),
  hba1c: [7.8, 7.6, 7.3, 7.1, 6.9, 6.8].map((value, i) => ({ collectedOn: `2026-0${3 + i}-15`, value })),
  diagnoses: [
    diagnosis(1, "I10", "Essential (primary) hypertension", "2026-08-20"),
    diagnosis(2, "E11.9", "Type 2 diabetes mellitus without complications", "2026-08-20"),
    diagnosis(3, "E78.5", "Hyperlipidemia, unspecified", "2026-06-02"),
    diagnosis(4, "J06.9", "Acute upper respiratory infection, unspecified", "2025-11-14", "2025-11-28"),
    diagnosis(5, "M54.50", "Low back pain, unspecified", "2025-03-30", "2025-04-20"),
  ],
  notes: {
    ownToday: null,
    recent: [note(1, "Synthetic follow-up note: reviewed demo HbA1c trend with the patient (example text).", "2026-10-12")],
  },
};

/** Case 3: asthma; SpO₂ falls into the demo critical band and heart rate into the warning band. */
export const ASTHMA_CASE: ClinicalContent = {
  vitals: vitals([
    [88, 122, 78, 97, 98.3],
    [92, 124, 79, 96, 98.5],
    [96, 121, 77, 95, 98.6],
    [101, 123, 78, 94, 98.8],
    [105, 122, 80, 92, 99.0],
    [108, 124, 80, 91, 99.1],
  ]),
  hba1c: [],
  diagnoses: [
    diagnosis(6, "J45.901", "Unspecified asthma with (acute) exacerbation", "2026-08-23"),
    diagnosis(7, "J06.9", "Acute upper respiratory infection, unspecified", "2026-01-05", "2026-01-19"),
  ],
  notes: {
    ownToday: {
      ...note(2, "Synthetic note in progress: demo inhaler technique reviewed (example text).", "2026-10-22", RECORDER),
      version: 3,
    },
    recent: [note(3, "Synthetic triage note (example text).", "2026-10-20")],
  },
};

/** Case 2: well patient, stable vitals, no HbA1c. */
export const WELL_CASE: ClinicalContent = {
  vitals: vitals([
    [68, 118, 76, 99, 98.1],
    [70, 116, 74, 99, 98.4],
    [66, 120, 78, 98, 98.2],
    [72, 118, 75, 99, 98.6],
    [69, 117, 76, 99, 98.3],
    [70, 118, 76, 99, 98.4],
  ]),
  hba1c: [{ collectedOn: "2026-07-10", value: 5.6 }],
  diagnoses: [
    diagnosis(8, "J30.2", "Other seasonal allergic rhinitis", "2026-04-11"),
    diagnosis(9, "S93.401A", "Sprain of unspecified ligament of right ankle, initial encounter", "2025-09-02", "2025-10-01"),
  ],
  notes: NO_NOTES,
};

export const EMPTY_CASE: ClinicalContent = { vitals: [], hba1c: [], diagnoses: [], notes: NO_NOTES };
