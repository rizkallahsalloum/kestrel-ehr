import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginCard } from "@/features/auth/components/login-card";
import { homePathFor } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in | Kestrel EHR" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <LoginCard>
      <LoginForm />
    </LoginCard>
  );
}
