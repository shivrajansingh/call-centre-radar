import { expect, test } from "@playwright/test";
import { apiGet, login } from "../helpers";

test.describe("TC-31 — Register an agent (manager/admin)", () => {
  test("registers an agent and lands on the new profile", async ({ page }) => {
    await login(page);
    const name = `E2E Test Agent ${Date.now()}`;

    await page.goto("/agents");
    await page.getByRole("button", { name: /Register agent/ }).click();

    const modal = page.getByText("Register an agent", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')]");
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: "Register" })).toBeDisabled();

    await modal.getByPlaceholder("e.g. Sam Carter").fill(name);
    await expect(modal.getByRole("button", { name: "Register" })).toBeEnabled();

    await modal.getByRole("button", { name: "Register" }).click();

    await expect(page).toHaveURL(/\/agents\/\d+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("0 calls handled")).toBeVisible();

    const aid = Number(page.url().match(/\/agents\/(\d+)$/)![1]);
    const persisted = await apiGet(page, `/agents/${aid}`);
    expect(persisted.name).toBe(name);
    expect(persisted.calls).toEqual([]);
  });
});