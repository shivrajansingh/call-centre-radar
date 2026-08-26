import { expect, test } from "@playwright/test";
import { login } from "../helpers";

test.describe("TC-16 — Dashboard deep-links land on the filtered calls page", () => {
  test("All calls → keeps default sort; View all → applies attention sort", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: "All calls →" }).click();
    await expect(page).toHaveURL(/\/calls$/);
    await expect(page.locator("select").nth(1)).toHaveValue("recent");
    await expect(page.locator("tbody tr")).toHaveCount(25);

    await page.goto("/");
    await page.getByRole("link", { name: "View all →" }).click();
    await expect(page).toHaveURL(/\/calls\?sort=attention/);
    await expect(page.locator("select").nth(1)).toHaveValue("attention");
    await expect(page.getByText(/sorted by attention score/)).toBeVisible();
  });
});