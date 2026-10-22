import { unstable_rethrow } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { listMyQueue } from "@/features/patients/queries";
import type { QueuePatient } from "@/features/patients/queue";
import { requireUser } from "@/lib/auth/guards";
import { signOut } from "../(auth)/login/actions";

async function loadQueue(): Promise<QueuePatient[] | null> {
  try {
    return await listMyQueue();
  } catch (error) {
    unstable_rethrow(error);
    // The queue is navigation only; pages still load and the top bar says "Queue unavailable".
    return null;
  }
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Shell only: every page and data access function re-checks the user itself.
  const user = await requireUser();
  const queue = user.role === "clinician" ? await loadQueue() : undefined;

  return (
    <AppShell
      user={{ fullName: user.fullName, role: user.role }}
      signOutAction={signOut}
      queue={queue}
      renderedAt={new Date().toISOString()}
    >
      {children}
    </AppShell>
  );
}
