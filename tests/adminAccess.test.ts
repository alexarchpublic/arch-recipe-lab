import { describe, expect, it } from "vitest";
import {
  decideAdminAccess,
  hasLegacyAdminDomain,
  isMissingFunctionError,
} from "../lib/adminAccess";

describe("admin access (PRD A1)", () => {
  it("allows only when the database says the user is on the allowlist", () => {
    expect(decideAdminAccess({ data: true, error: null }, "someone@archpublic.com")).toEqual({
      allowed: true,
      source: "allowlist",
    });
    expect(decideAdminAccess({ data: false, error: null }, "someone@archpublic.com")).toEqual({
      allowed: false,
      source: "allowlist",
    });
  });

  it("does not let a company email in once the allowlist exists", () => {
    // Self-registered @archpublic.com accounts that are not listed are refused.
    expect(decideAdminAccess({ data: false, error: null }, "new.hire@archpublic.com").allowed).toBe(false);
    expect(decideAdminAccess({ data: null, error: null }, "new.hire@archpublic.com").allowed).toBe(false);
  });

  it("falls back to the old domain rule only while is_admin() is not deployed", () => {
    const missing = { code: "PGRST202", message: "Could not find the function public.is_admin" };
    expect(decideAdminAccess({ data: null, error: missing }, "a@archpublic.com")).toEqual({
      allowed: true,
      source: "legacy-domain",
    });
    expect(decideAdminAccess({ data: null, error: missing }, "a@gmail.com").allowed).toBe(false);
    expect(decideAdminAccess({ data: null, error: missing }, "a@thearchpublic.com").allowed).toBe(false);
  });

  it("denies on any other error", () => {
    const network = { code: "500", message: "upstream timeout" };
    expect(decideAdminAccess({ data: null, error: network }, "a@archpublic.com").allowed).toBe(false);
  });

  it("recognises missing-function errors from PostgREST and Postgres", () => {
    expect(isMissingFunctionError({ code: "PGRST202" })).toBe(true);
    expect(isMissingFunctionError({ code: "42883" })).toBe(true);
    expect(isMissingFunctionError({ message: "function public.is_admin() does not exist" })).toBe(true);
    expect(isMissingFunctionError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingFunctionError(null)).toBe(false);
  });

  it("matches the legacy domain exactly, ignoring case and spaces", () => {
    expect(hasLegacyAdminDomain(" A@ArchPublic.com ")).toBe(true);
    expect(hasLegacyAdminDomain("a@archpublic.com.evil.io")).toBe(false);
    expect(hasLegacyAdminDomain(undefined)).toBe(false);
  });
});
