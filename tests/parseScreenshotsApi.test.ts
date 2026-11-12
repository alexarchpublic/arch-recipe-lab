// The screenshot import endpoint's admin gate. A signed-in admin must get past
// the gate (here to the "no vision key" 503), not a 500 from a null result.
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null as { email: string } | null, isAdmin: false }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () =>
        auth.user ? { data: { user: auth.user }, error: null } : { data: { user: null }, error: { message: "bad jwt" } },
    },
    rpc: async (name: string) =>
      name === "is_admin" ? { data: auth.isAdmin, error: null } : { data: null, error: { message: "unexpected" } },
  }),
}));

import handler from "../api/parse-recipe-screenshots";

async function post(token = "token") {
  const response = (await handler(
    new Request("http://localhost/api/parse-recipe-screenshots", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ images: [] }),
    }),
  )) as Response;
  return { status: response.status, body: await response.json() };
}

describe("parse-recipe-screenshots admin gate", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("lets an allowlisted admin through", async () => {
    auth.user = { email: "alex@archpublic.com" };
    auth.isAdmin = true;
    const result = await post();
    expect(result.status).toBe(503);
    expect(result.body.error).toMatch(/needs ANTHROPIC_API_KEY/);
  });

  it("refuses a signed-in user who is not on the allowlist", async () => {
    auth.user = { email: "someone@example.com" };
    auth.isAdmin = false;
    expect(await post()).toEqual({ status: 403, body: { error: "Admin access required" } });
  });

  it("refuses an invalid token", async () => {
    auth.user = null;
    expect(await post()).toEqual({ status: 403, body: { error: "Admin access required" } });
  });
});
