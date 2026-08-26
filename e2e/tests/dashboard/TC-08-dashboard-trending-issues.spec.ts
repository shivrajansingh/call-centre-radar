import { expect, test } from "@playwright/test";
import { apiGet, login } from "../helpers";

test.describe("TC-08 — Trending issues render with counts and open rates", () => {
  test("issue rows match /trending payload", async ({ page }) => {
    await login(page);
    const issues = (await apiGet(page, "/trending")).issues as {
      label: string;
      count: number;
      unresolved_rate: number;
    }[];

    const section = page
      .locator("main")
      .getByText("Trending issues")
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')]");
    await expect(section).toBeVisible();

    const rows = section.locator("div.flex.items-center.gap-3");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(10);

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const label = issues[i]?.label;
      if (label) await expect(row).toContainText(label);
      await expect(row).toContainText(String(issues[i].count));
      await expect(row).toContainText(
        `${Math.round(issues[i].unresolved_rate * 100)}% open`,
      );
    }
  });
});