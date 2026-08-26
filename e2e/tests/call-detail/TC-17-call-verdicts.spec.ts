import { expect, test } from "@playwright/test";
import { apiGet, login, SID_WITH_REVIEW } from "../helpers";

test.describe("TC-17 — Call detail verdicts with citations", () => {
  test("summary, intent, resolution, mood rows render with citations", async ({ page }) => {
    await login(page);
    await page.goto(`/calls/${SID_WITH_REVIEW}`);

    const detail = await apiGet(page, `/calls/${SID_WITH_REVIEW}`);
    const a = detail.analysis;

    await expect(
      page.getByRole("heading", { name: "Mary Smith with Robert" }),
    ).toBeVisible();
    await expect(page.locator("main")).toContainText(SID_WITH_REVIEW);

    const summaryCard = page
      .getByRole("heading", { name: "Summary" })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await expect(summaryCard.getByText(a.summary)).toBeVisible();
    await expect(summaryCard.getByText(a.intent_label)).toBeVisible();
    await expect(summaryCard.getByText("resolved")).toBeVisible();
    await expect(summaryCard.getByText(a.mood_start)).toBeVisible();
    await expect(summaryCard.getByText(a.mood_end)).toBeVisible();

    const citations = summaryCard.locator("button[title^='“']");
    await expect(citations).toHaveCount(2);

    for (const cite of [a.intent_citation, a.resolution_citation]) {
      const btn = summaryCard.locator("button", { hasText: `@${Math.round(cite.t_start)}s` });
      await expect(btn).toBeVisible();
      const title = await btn.getAttribute("title");
      expect(title).toContain(cite.quote);
      expect(title).toContain(`@ ${cite.t_start.toFixed(1)}s`);
    }
  });
});