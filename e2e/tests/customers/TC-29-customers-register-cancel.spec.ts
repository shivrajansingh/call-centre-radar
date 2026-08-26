import { expect, test } from "@playwright/test";
import { login } from "../helpers";

test.describe("TC-29 — Register-customer modal cancel paths", () => {
  test("modal closes via Cancel, ✕, Escape and backdrop", async ({ page }) => {
    await login(page);
    await page.goto("/customers");

    async function openModal() {
      await page.getByRole("button", { name: /Register customer/ }).click();
      await expect(page.getByText("Register a customer", { exact: true })).toBeVisible();
    }
    async function expectClosed() {
      await expect(page.getByText("Register a customer", { exact: true })).toHaveCount(0);
    }

    await openModal();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expectClosed();

    await openModal();
    await page
      .getByText("Register a customer", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'fixed')]")
      .getByRole("button")
      .first()
      .click();
    await expectClosed();

    await openModal();
    await page.keyboard.press("Escape");
    await expectClosed();

    await openModal();
    await page.mouse.click(10, 10);
    await expectClosed();

    const rows = await page.locator("tbody tr").count();
    expect(rows).toBeGreaterThan(0);
  });
});