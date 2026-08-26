import { expect, test } from "@playwright/test";
import { apiGet, login, SID_WITH_REVIEW } from "../helpers";

test.describe("TC-24 — Evidence integrity footer reflects verified citations", () => {
  test("green footer with 100% on a fully verified call", async ({ page }) => {
    await login(page);
    await page.goto(`/calls/${SID_WITH_REVIEW}`);

    const a = (await apiGet(page, `/calls/${SID_WITH_REVIEW}`)).analysis;

    const footer = page.locator("main").getByText(/Evidence integrity:/);
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(
      `${Math.round(a.citations_verified * 100)}% of citations verified verbatim against the transcript`,
    );

    const box = footer.locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await expect(box).toHaveClass(/border-good/);
    await expect(box.locator("svg")).toBeVisible();
  });
});