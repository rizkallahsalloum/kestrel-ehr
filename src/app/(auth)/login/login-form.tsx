"use client";

import { useActionState } from "react";
import { Button, FormErrors, FormField, TextInput } from "@/components/ui";
import { PrivacyReset } from "@/features/privacy/components/privacy-controls";
import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, null);
  const errors = state && !state.ok ? state.errors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <PrivacyReset />
      <FormErrors messages={errors?.formErrors} />
      <FormField id="email" label="Email" errors={errors?.fieldErrors.email}>
        <TextInput name="email" type="email" autoComplete="username" required />
      </FormField>
      <FormField id="password" label="Password" errors={errors?.fieldErrors.password}>
        <TextInput name="password" type="password" autoComplete="current-password" required />
      </FormField>
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
