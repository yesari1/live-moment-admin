import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PasswordLoginPage } from "./PasswordLogin";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ demoMode: true, getIdToken: vi.fn() }) }));
it("renders a read-only demo with accessible email and masked password fields", () => {
  const html = renderToStaticMarkup(<PasswordLoginPage />);
  expect(html).toContain("Password Login");
  expect(html).toContain("Demo Mode");
  expect(html).toContain('type="email"');
  expect(html).toContain('type="password"');
  expect(html).toContain('minLength="8"');
  expect(html).toContain('maxLength="128"');
  expect(html).toContain('aria-label="Show Password"');
  expect(html).toMatch(/type="submit"[^>]*disabled/);
});
