import { expect, test } from "@playwright/test";
import { getToken } from "../helpers";

test.describe("TC-02 — Login with invalid credentials shows an error", () => {
  test("rejects a wrong password and an unknown username without storing a token", async ({ page }) => {
    await page.goto("/login");

    await page.getByPlaceholder("admin").fill("admin");
    await page.getByPlaceholder("••••••••").fill("wrongpass");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/wrong username or password/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByPlaceholder("admin").fill("nobody");
    await page.getByPlaceholder("••••••••").fill("admin123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/wrong username or password/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await getToken(page)).toBeNull();
  });
});