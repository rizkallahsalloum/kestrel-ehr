import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/guards";
import { signOut } from "../(auth)/login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Shell only: every page and data access function re-checks the user itself.
  const user = await requireUser();

  return (
    <AppShell user={{ fullName: user.fullName, role: user.role }} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
