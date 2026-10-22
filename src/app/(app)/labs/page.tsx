import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Labs | Kestrel EHR" };

export default async function LabsPage() {
  await requireRole("clinician");
  return <PlaceholderPage title="Labs" />;
}
