import Link from "next/link";
import { buttonStyles, Card } from "@/components/ui";

/** Rail destinations that exist in the design but not in this prototype. No patient data. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-heading-xl font-semibold text-ink">{title}</h1>
      <Card>
        <p className="text-body text-ink-strong">Not part of this prototype.</p>
        <p className="mt-1 text-body-sm text-ink-muted">
          Kestrel EHR models patient charts, allergies, medications and demo prescriptions only.
        </p>
        <Link href="/patients" className={buttonStyles({ variant: "secondary", size: "sm", className: "mt-4" })}>
          Go to patients
        </Link>
      </Card>
    </div>
  );
}
