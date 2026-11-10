// Who may use the admin console (PRD A1).
//
// The database decides: public.is_admin() is true only for emails on
// public.admin_users. Until that migration is applied the function does not
// exist, and the old rule (an @archpublic.com email) is used instead, so this
// code can ship before or after the migration without locking anyone out.
// The database enforces the same rule on every write either way.

export const LEGACY_ADMIN_DOMAIN = "@archpublic.com";

export type AdminCheckSource = "allowlist" | "legacy-domain";

export interface AdminDecision {
  allowed: boolean;
  source: AdminCheckSource;
}

interface RpcError {
  code?: string;
  message?: string;
}

/** True when the error means public.is_admin() is not deployed yet. */
export function isMissingFunctionError(error: RpcError | null | undefined): boolean {
  if (!error) return false;
  // PGRST202: PostgREST cannot find the function. 42883: Postgres "undefined function".
  if (error.code === "PGRST202" || error.code === "42883") return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? "");
}

export function hasLegacyAdminDomain(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase().endsWith(LEGACY_ADMIN_DOMAIN);
}

/**
 * Turn the result of `rpc("is_admin")` into an access decision.
 * Any error other than "function missing" denies access.
 */
export function decideAdminAccess(
  rpc: { data: unknown; error: RpcError | null },
  email: string | null | undefined,
): AdminDecision {
  if (rpc.error) {
    if (isMissingFunctionError(rpc.error)) {
      return { allowed: hasLegacyAdminDomain(email), source: "legacy-domain" };
    }
    return { allowed: false, source: "allowlist" };
  }
  return { allowed: rpc.data === true, source: "allowlist" };
}

export const ADMIN_DENIED_MESSAGE =
  "This account is not on the admin list. Ask the Strategy Lab owner to add you.";
