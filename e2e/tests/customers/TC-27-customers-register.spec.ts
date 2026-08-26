import { expect, test } from "@playwright/test";
import { apiGet, login } from "../helpers";

test.describe("TC-27 — Register a customer (manager/admin)", () => {
  test("registers a customer and lands on the new profile", async ({ page }) => {
    await login(page);
    const name = `E2E Test Customer ${Date.now()}`;

    await page.goto("/customers");
    await page.getByRole("button", { name: /Register customer/ }).click();

    const modal = page.getByText("Register a customer", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')]");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: "Register" })).toBeDisabled();

    await modal.getByPlaceholder("e.g. Jane Doe").fill(name);
    await expect(modal.getByRole("button", { name: "Register" })).toBeEnabled();

    await modal.getByRole("button", { name: "Register" }).click();

    await expect(page).toHaveURL(/\/customers\/\d+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("0 calls in total")).toBeVisible();

    const cid = Number(page.url().match(/\/customers\/(\d+)$/)![1]);
    const persisted = await apiGet(page, `/customers/${cid}`);
    expect(persisted.name).toBe(name);
    expect(persisted.calls).toEqual([]);
  });
});