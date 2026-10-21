"use client"; // Clears this tab's Privacy mode state before the sign-out request.

import { Button } from "@/components/ui";
import { getPrivacyStore } from "@/features/privacy/store";

/** Sign-out control. Signing out also turns Privacy mode off; the session handling is unchanged. */
export function SignOutButton({ action }: { action?: () => Promise<void> }) {
  const clearPrivacy = () => getPrivacyStore().forget();
  if (!action) {
    return (
      <Button variant="quiet" size="sm" onClick={clearPrivacy}>
        Sign out
      </Button>
    );
  }
  return (
    <form action={action} onSubmit={clearPrivacy}>
      <Button type="submit" variant="quiet" size="sm">
        Sign out
      </Button>
    </form>
  );
}
