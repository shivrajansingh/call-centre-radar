import { expect, test } from "@playwright/test";
import { ensureUser, login, logoutViaMenu } from "../helpers";

test.describe("TC-40 — Change a user's role", () => {
  test("own role select is locked; role change persists and affects login", async ({ page }) => {
    await login(page);
    await ensureUser(page, "E2E Role User", "e2erole", "e2erole123", "agent");
    await page.goto("/users");

    const adminRow = page.locator("tbody tr").filter({ hasText: "Administrator" });
    await expect(adminRow.locator("select")).toBeDisabled();

    const row = page.locator("tbody tr").filter({ hasText: "e2erole" });
    await row.locator("select").selectOption("manager");
    await expect(page.getByText("E2E Role User is now manager")).toBeVisible();
    await expect(row.locator("select")).toHaveValue("manager");

    await page.reload();
    await expect(
      page.locator("tbody tr").filter({ hasText: "e2erole" }).locator("select"),
    ).toHaveValue("manager");

    await logoutViaMenu(page);
    await login(page, "e2erole", "e2erole123");
    await expect(page.locator("header")).toContainText("manager");
    await expect(page.locator("aside").getByRole("link", { name: "Upload" })).toBeVisible();
  });
});