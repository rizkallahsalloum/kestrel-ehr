"use server";

import { redirect } from "next/navigation";
import { fail, validationFailure, type ActionResult } from "@/lib/actions/result";
import { homePathFor } from "@/lib/auth/guards";
import { resolveCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/features/auth/schemas";

export type LoginState = ActionResult<null> | null;

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // One generic message, so the form does not reveal which accounts exist.
    return fail("UNAUTHENTICATED", "Email or password is incorrect.");
  }

  const user = await resolveCurrentUser(supabase);
  if (!user) {
    await supabase.auth.signOut();
    return fail("FORBIDDEN", "This account is not active. Contact an administrator.");
  }

  redirect(homePathFor(user.role));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
