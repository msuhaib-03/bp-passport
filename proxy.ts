import createMiddleware from "next-intl/middleware";
import { routing } from "./lib/i18n/routing";

/**
 * Locale negotiation and redirects.
 *
 * Next 16 renamed the `middleware` convention to `proxy`; the behaviour is
 * unchanged. This resolves the incoming locale, redirects a bare `/` to the
 * negotiated locale, and rewrites so the rest of the app always sees an explicit
 * `[locale]` segment.
 *
 * This is also the correct home for the auth and RBAC checks that arrive with
 * the Clinician Portal — patient routes, `/portal` and `/admin` are three
 * different trust levels served by one deployment, and every request should be
 * classified here before it reaches a route handler.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except Next internals, static assets and the API surface.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
