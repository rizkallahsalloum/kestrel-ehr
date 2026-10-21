import type { Instrumentation } from "next";
import { digestOf, referenceFromDigest } from "@/lib/errors/reference";

/**
 * Server errors (Server Components, Server Actions, route handlers, proxy) are logged here with the
 * reference the error page shows. The route pattern is logged instead of the request path, whose
 * query string can hold patient search text.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest = digestOf(error);
  console.error("[kestrel] server error", {
    reference: digest ? referenceFromDigest(digest) : undefined,
    digest,
    route: context.routePath,
    routeType: context.routeType,
    method: request.method,
    error,
  });
};
