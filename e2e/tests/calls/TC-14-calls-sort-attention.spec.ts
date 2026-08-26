import { expect, test } from "@playwright/test";
import { apiGet, login } from "../helpers";

test.describe("TC-14 — Sort by attention score", () => {
  test("attention sort matches the API order", async ({ page }) => {
    await login(page);
    await page.goto("/calls");

    const sort = page.locator("select").nth(1);
    await expect(sort).toHaveValue("recent");
    await expect(page.getByText(/sorted by recency/)).toBeVisible();

    await sort.selectOption("attention");
    await expect(page.getByText(/sorted by attention score/)).toBeVisible();

    const api = await apiGet(page, "/calls?sort=attention&limit=25&offset=0");
    const firstSid = api.calls[0].sid as string;

    const rows = page.locator("tbody tr");
    const scores: number[] = [];
    for (let i = 0; i < 25; i++) {
      const t = await rows.nth(i).locator("td").nth(5).innerText();
      const v = parseFloat(t);
      if (Number.isFinite(v)) scores.push(v);
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }

    await rows.first().click();
    await expect(page).toHaveURL(`/calls/${firstSid}`);
  });
});