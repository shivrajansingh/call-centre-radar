import { expect, test } from "@playwright/test";
import { login } from "../helpers";

test.describe("TC-07 — Attention queue renders ranked calls", () => {
  test("queue is ranked, richly annotated and navigates", async ({ page }) => {
    await login(page);

    const section = page.locator("main").getByText("Needs a manager's attention").locator("xpath=ancestor::div[contains(@class,'rounded-xl')]");
    await expect(section).toBeVisible();
    await expect(section.getByRole("link", { name: "View all →" })).toHaveAttribute(
      "href",
      "/calls?sort=attention",
    );

    const items = section.locator('a[href^="/calls/"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8);

    const scores: number[] = [];
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const scoreText = await item.locator("span.rounded-full").first().innerText();
      scores.push(parseFloat(scoreText));
      await expect(item).toContainText("·");
      await expect(item.locator("span.rounded-full").nth(-1)).toHaveText(
        /^(positive|neutral|concerned|frustrated|angry|anxious|–)$/,
      );
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }

    await items.first().click();
    await expect(page).toHaveURL(/\/calls\/[0-9a-f]{16}$/);

    await page.goto("/");
    await section.getByRole("link", { name: "View all →" }).click();
    await expect(page).toHaveURL(/\/calls\?sort=attention/);
    await expect(page.locator("select").nth(1)).toHaveValue("attention");
  });
});