import { expect, test } from "@playwright/test";
import { ensureUser, getToken, login, logoutViaMenu } from "../helpers";

test.describe("TC-38 — Users page is admin-only", () => {
  test("admin sees Users; manager is redirected away", async ({ page }) => {
    await login(page);
    await ensureUser(page, "E2E Manager User", "e2emanager", "e2emanager123", "manager");

    await expect(page.locator("aside").getByRole("link", { name: "Users" })).toBeVisible();
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users & roles" })).toBeVisible();

    await logoutViaMenu(page);
    await login(page, "e2emanager", "e2emanager123");
    await expect(page.locator("aside").getByRole("link", { name: "Users" })).toHaveCount(0);

    await page.goto("/users");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Operations dashboard" })).toBeVisible();

    const token = await getToken(page);
    const res = await page.request.get("http://localhost:8100/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
    expect(await res.text()).toContain("admin required");
  });
});