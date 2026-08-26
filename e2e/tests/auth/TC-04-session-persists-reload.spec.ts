import { expect, test } from "@playwright/test";
import { getToken, login } from "../helpers";

test.describe("TC-04 — Session persists across reload", () => {
  test("keeps the session after page reloads", async ({ page }) => {
    await login(page);

    expect(await getToken(page)).toBeTruthy();

    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Operations dashboard" })).toBeVisible();
    await expect(page.locator("header")).toContainText("Administrator");

    await page.goto("/calls");
    await expect(page.getByRole("heading", { name: "Calls" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Calls" })).toBeVisible();
    await expect(page.locator("header")).toContainText("Administrator");
    await expect(page.locator("header")).toContainText("admin");
  });
});