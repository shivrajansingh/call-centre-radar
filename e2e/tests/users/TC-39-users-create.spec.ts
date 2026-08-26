import { expect, test } from "@playwright/test";
import { login } from "../helpers";

test.describe("TC-39 — Create a user with validation", () => {
  test("button gating, creation toast and duplicate rejection", async ({ page }) => {
    await login(page);
    const username = `e2eui${Date.now()}`;

    await page.goto("/users");
    await page.getByRole("button", { name: /New user/ }).click();

    const modal = page.getByText("Create a user", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')]");
    await expect(modal).toBeVisible();
    const createBtn = modal.getByRole("button", { name: "Create user" });
    await expect(createBtn).toBeDisabled();

    await modal.getByPlaceholder("e.g. Dana Price").fill("E2E UI User");
    await modal.getByPlaceholder("dana", { exact: true }).fill(username);
    await modal.getByPlaceholder("min 6 characters").fill("abc");
    await expect(createBtn).toBeDisabled();

    await modal.getByPlaceholder("min 6 characters").fill("e2euser123");
    await expect(createBtn).toBeEnabled();

    await modal.locator("select").selectOption("agent");
    await createBtn.click();

    await expect(page.getByText("User created")).toBeVisible();
    await expect(modal).toHaveCount(0);

    const row = page.locator("tbody tr").filter({ hasText: username });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("E2E UI User");
    await expect(row.locator("select")).toHaveValue("agent");
    await expect(row.getByText("active", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /New user/ }).click();
    await modal.getByPlaceholder("e.g. Dana Price").fill("E2E UI User Dupe");
    await modal.getByPlaceholder("dana", { exact: true }).fill(username);
    await modal.getByPlaceholder("min 6 characters").fill("e2euser123");
    await modal.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText(/already exists/)).toBeVisible();
    await expect(modal).toBeVisible();
  });
});