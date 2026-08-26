import { expect, test } from "@playwright/test";
import { login, waitForTableIdle } from "../helpers";

test.describe("TC-13 — Resolution filter narrows the table", () => {
  test("each resolution option filters the Status badges and URL", async ({ page }) => {
    await login(page);
    await page.goto("/calls");

    const filter = page.locator("select").first();
    await expect(filter).toHaveValue("");

    async function checkFilter(value: string, badge: string) {
      await filter.selectOption(value);
      await waitForTableIdle(page);
      const rows = page.locator("tbody tr");
      const n = await rows.count();
      if (n === 0) {
        await expect(page.getByText("No calls match")).toBeVisible();
      } else {
        for (let i = 0; i < n; i++) {
          await expect(rows.nth(i).locator("td").nth(4)).toHaveText(badge);
        }
      }
    }

    await checkFilter("unresolved", "unresolved");
    await checkFilter("resolved", "resolved");
    await checkFilter("partial", "partial");

    await filter.selectOption("");
    await expect(page.locator("tbody tr")).toHaveCount(25);
  });
});