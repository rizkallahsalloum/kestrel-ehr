import type { Metadata } from "next";
import { PatientList } from "@/features/patients/components/patient-list";
import { listMyPatients } from "@/features/patients/queries";
import { filterPatients, parsePatientQuery } from "@/features/patients/search";

export const metadata: Metadata = { title: "Patients | Kestrel EHR" };

export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const query = parsePatientQuery((await searchParams).q);
  const patients = filterPatients(await listMyPatients(), query);

  return <PatientList patients={patients} query={query} />;
}
