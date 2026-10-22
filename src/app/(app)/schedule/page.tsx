import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Schedule | Kestrel EHR" };

export default async function SchedulePage() {
  await requireRole("clinician");
  return <PlaceholderPage title="Schedule" />;
}
