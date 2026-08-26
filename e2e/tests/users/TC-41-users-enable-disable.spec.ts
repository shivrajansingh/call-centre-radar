import { expect, test } from "@playwright/test";
import { attemptLogin, ensureUser, login, logoutViaMenu } from "../helpers";

test.describe("TC-41 — Enable / disable a user", () => {
  test("disabling blocks login, enabling restores it", async ({ page }) => {
    await login(page);
    await ensureUser(page, "E2E Disable User", "e2edisable", "e2edisable123", "agent");
    await page.goto("/users");

    const row = page.locator("tbody tr").filter({ hasText: "e2edisable" });
    await expect(row.getByText("active", { exact: true })).toBeVisible();

    await row.locator("button[title='Disable']").click();
    await expect(page.getByText("E2E Disable User disabled")).toBeVisible();
    await expect(row.getByText("disabled", { exact: true })).toBeVisible();
    await expect(row.locator("button[title='Enable']")).toBeVisible();

    await logoutViaMenu(page);
    await attemptLogin(page, "e2edisable", "e2edisable123");
    await expect(page.getByText(/wrong username or password/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await login(page);
    await page.goto("/users");
    const row2 = page.locator("tbody tr").filter({ hasText: "e2edisable" });
    await row2.locator("button[title='Enable']").click();
    await expect(page.getByText("E2E Disable User enabled")).toBeVisible();
    await expect(row2.getByText("active", { exact: true })).toBeVisible();

    await logoutViaMenu(page);
    await attemptLogin(page, "e2edisable", "e2edisable123");
    await expect(page).toHaveURL("/");

    await logoutViaMenu(page);
    await login(page);
    await page.goto("/users");
    const adminRow = page.locator("tbody tr").filter({ hasText: "Administrator" });
    await expect(adminRow.locator("button[title='Disable account']")).toHaveCount(0);
    await expect(adminRow.locator("select")).toBeDisabled();
  });
});