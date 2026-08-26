import { expect, test } from "@playwright/test";
import { login, SID_WITH_REVIEW, waitForTableIdle } from "../helpers";

test.describe("TC-12 — Search filters the calls table", () => {
  test("search by customer, intent, sid and no-match", async ({ page }) => {
    await login(page);
    await page.goto("/calls");

    const search = page.getByPlaceholder("Search customer, agent, intent, call ID…");
    const rows = page.locator("tbody tr");

    await search.fill("Mary Smith");
    await search.press("Enter");
    await waitForTableIdle(page);
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i).locator("td").nth(1)).toContainText("Mary Smith");
    }

    await search.fill("credit card");
    await search.press("Enter");
    await waitForTableIdle(page);
    const n2 = await rows.count();
    expect(n2).toBeGreaterThan(0);
    for (let i = 0; i < n2; i++) {
      await expect(rows.nth(i).locator("td").nth(3)).toContainText("credit card");
    }

    await search.fill(SID_WITH_REVIEW);
    await search.press("Enter");
    await waitForTableIdle(page);
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator("td").nth(1)).toContainText("Mary Smith");

    await search.fill("zzz-no-such-call-xyz");
    await search.press("Enter");
    await waitForTableIdle(page);
    await expect(page.getByText("No calls match")).toBeVisible();
    await expect(rows).toHaveCount(0);

    await search.fill("");
    await search.press("Enter");
    await waitForTableIdle(page);
    await expect(rows).toHaveCount(25);
  });
});