/** Length of the reference shown to users; the server log carries the same value. */
export const REFERENCE_LENGTH = 10;

/** Short reference for a Next.js error digest, shown on screen and written to the server log. */
export function referenceFromDigest(digest: string): string {
  return digest.slice(0, REFERENCE_LENGTH);
}

/** Fresh reference for an error that has no digest (one thrown in the browser). */
export function newReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(REFERENCE_LENGTH / 2));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** The digest Next.js attaches to errors from Server Components and Server Actions, if any. */
export function digestOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) return undefined;
  const { digest } = error as { digest: unknown };
  return typeof digest === "string" && digest.length > 0 ? digest : undefined;
}
