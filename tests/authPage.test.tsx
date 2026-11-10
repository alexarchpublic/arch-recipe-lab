// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import Auth from "@/pages/Auth";

describe("admin sign-in page (PRD A1: self-registration closed)", () => {
  beforeEach(() => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

  it("offers no way to create an account", () => {
    renderPage();
    expect(screen.queryByText(/sign up/i)).toBeNull();
    expect(screen.queryByText(/create account/i)).toBeNull();
    expect(screen.getByText(/by invitation/i)).toBeTruthy();
  });

  it("signs in and never calls sign-up", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@archpublic.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalledTimes(1));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@archpublic.com",
      password: "correct horse",
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});
