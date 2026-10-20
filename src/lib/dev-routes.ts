/**
 * Development-only routes (the theme specimen) render static content and never
 * touch Supabase, so the proxy skips them in development. In any other
 * environment they go through the normal session check and the pages return 404.
 */
export function isDevOnlyPath(pathname: string, nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "development" && (pathname === "/dev" || pathname.startsWith("/dev/"));
}
