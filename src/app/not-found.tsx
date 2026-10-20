import Link from "next/link";
import { StatusPage } from "@/components/shell/status-page";
import { buttonStyles, InfoIcon } from "@/components/ui";

export default function NotFound() {
  return (
    <StatusPage
      title="Not found"
      icon={<InfoIcon className="text-ink-secondary" />}
      message="This record does not exist or you do not have access to it."
      actions={
        <Link href="/" className={buttonStyles({ variant: "secondary", size: "sm" })}>
          Back to Kestrel EHR
        </Link>
      }
    />
  );
}
