/** Whether a path belongs to the development-only specimens under `/dev`. */
export function isDevPath(pathname: string): boolean {
  return pathname === "/dev" || pathname.startsWith("/dev/");
}

/**
 * Development-only routes render static content and never touch Supabase, so the proxy skips
 * them in development. In any other environment the proxy answers 404 before any session check,
 * for signed-in and signed-out visitors alike (the pages also call `notFound()` there).
 */
export function isDevOnlyPath(pathname: string, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "development" && isDevPath(pathname);
}
