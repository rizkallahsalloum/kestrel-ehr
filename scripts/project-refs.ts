/**
 * The Kestrel-Dev project (used by `pnpm dev` through .env.local). Not a secret: it is part of
 * the public API URL. Test scripts refuse it, and only `scripts/seed-dev.ts` may target it.
 */
export const KESTREL_DEV_PROJECT_REF = "lcpopxpoctphdodxzitx";

export function isDevProjectRef(ref: string | null | undefined): boolean {
  return ref?.trim() === KESTREL_DEV_PROJECT_REF;
}
