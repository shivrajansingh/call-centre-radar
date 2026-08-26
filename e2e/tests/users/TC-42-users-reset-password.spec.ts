import { expect, test } from "@playwright/test";
import { attemptLogin, ensureUser, login, logoutViaMenu } from "../helpers";

test.describe("TC-42 — Reset a user's password", () => {
  test("prompt cancel is a no-op; a new password replaces the old one", async ({ page }) => {
    await login(page);
    await ensureUser(page, "E2E Pass User", "e2epass", "e2epass123", "agent");
    await page.goto("/users");

    const row = page.locator("tbody tr").filter({ hasText: "e2epass" });
    const resetBtn = row.locator("button[title='Reset password']");

    page.once("dialog", d => d.dismiss());
    await resetBtn.click();
    await expect(page.getByText("Password updated")).toHaveCount(0);

    page.once("dialog", d => d.accept("newpass456"));
    await resetBtn.click();
    await expect(page.getByText("Password updated")).toBeVisible();

    await logoutViaMenu(page);
    await attemptLogin(page, "e2epass", "newpass456");
    await expect(page).toHaveURL("/");

    await logoutViaMenu(page);
    await attemptLogin(page, "e2epass", "e2epass123");
    await expect(page.getByText(/wrong username or password/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});