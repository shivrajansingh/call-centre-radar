import { expect, test } from "@playwright/test";
import { getToken, login } from "../helpers";

test.describe("TC-01 — Login with valid credentials", () => {
  test("signs in and lands on the operations dashboard", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Call-Centre Radar" })).toBeVisible();
    await expect(page.getByText(/Default credentials: admin \/ admin123/)).toBeVisible();
    await expect(page.getByPlaceholder("admin")).toBeFocused();

    await page.getByPlaceholder("admin").fill("admin");
    await page.getByPlaceholder("••••••••").fill("admin123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Operations dashboard" })).toBeVisible();

    await expect(page.locator("header")).toContainText("Administrator");
    await expect(page.locator("header")).toContainText("admin");
    await expect(page.locator("aside")).toContainText("admin");

    expect(await getToken(page)).toBeTruthy();
  });
});