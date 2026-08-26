import { expect, test } from "@playwright/test";

test.describe("TC-03 — Unauthenticated user is redirected to /login", () => {
  for (const path of ["/", "/calls", "/customers", "/agents", "/upload", "/users"]) {
    test(`redirects ${path} to /login when logged out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("heading", { name: "Call-Centre Radar" })).toBeVisible();
    });
  }
});