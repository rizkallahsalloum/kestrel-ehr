import "server-only";
import { notFound, redirect } from "next/navigation";
import { fail, type ActionFailure } from "@/lib/actions/result";
import type { AppRole } from "@/types/domain";
import { getCurrentUser, type CurrentUser } from "./session";

/** For pages and data access: redirects anonymous users to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages and data access: other roles get a 404 rather than a hint that the page exists. */
export async function requireRole(role: AppRole): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) notFound();
  return user;
}

export type ActionAuth = { ok: true; user: CurrentUser } | { ok: false; result: ActionFailure };

/** For Server Actions, which are public endpoints: returns a typed failure instead of redirecting. */
export async function authorizeAction(role?: AppRole): Promise<ActionAuth> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, result: fail("UNAUTHENTICATED", "Your session has ended. Sign in again.") };
  if (role && user.role !== role) {
    return { ok: false, result: fail("FORBIDDEN", "Your role cannot perform this action.") };
  }
  return { ok: true, user };
}

export function homePathFor(role: AppRole): string {
  return role === "admin" ? "/admin/audit" : "/patients";
}
