import { expect, test } from "@playwright/test";
import { getToken, login } from "../helpers";

test.describe("TC-05 — Sign out via avatar menu", () => {
  test("logs out, clears the token and re-guards the routes", async ({ page }) => {
    await login(page);

    await page.locator("header .relative button").first().click();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.locator("header")).toContainText("Administrator");

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Call-Centre Radar" })).toBeVisible();
    expect(await getToken(page)).toBeNull();

    await page.goto("/calls");
    await expect(page).toHaveURL(/\/login/);
  });
});