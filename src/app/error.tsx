"use client";

import Link from "next/link";
import { StatusPage } from "@/components/shell/status-page";
import { AlertTriangleIcon, Button, buttonStyles } from "@/components/ui";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <StatusPage
      title="Something went wrong"
      icon={<AlertTriangleIcon className="text-warning" />}
      message="The page could not be loaded. No partial patient data is shown when a required check fails."
      actions={
        <>
          <Button size="sm" onClick={() => retry()}>
            Try again
          </Button>
          <Link href="/" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            Back to Kestrel EHR
          </Link>
        </>
      }
    />
  );
}
