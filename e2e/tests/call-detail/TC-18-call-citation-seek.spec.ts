import { expect, test } from "@playwright/test";
import { apiGet, login, SID_WITH_REVIEW } from "../helpers";

test.describe("TC-18 — Citation buttons seek the audio and play", () => {
  test("clicking a citation seeks and plays the recording", async ({ page }) => {
    await login(page);
    await page.goto(`/calls/${SID_WITH_REVIEW}`);

    const detail = await apiGet(page, `/calls/${SID_WITH_REVIEW}`);
    const cite = detail.analysis.intent_citation;

    const summaryCard = page
      .getByRole("heading", { name: "Summary" })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const btn = summaryCard.locator("button", { hasText: `@${Math.round(cite.t_start)}s` });

    await btn.click();
    await expect(page.locator("main").getByText("Playing", { exact: true })).toBeVisible();

    await expect
      .poll(async () => {
        const s = await page.evaluate(() => {
          const el = document.querySelector<HTMLAudioElement>("audio");
          return el ? { t: el.currentTime, paused: el.paused } : null;
        });
        return s;
      })
      .toMatchObject({ paused: false });

    const state = await page.evaluate(() => {
      const el = document.querySelector<HTMLAudioElement>("audio");
      return el ? el.currentTime : 0;
    });
    expect(Math.abs(state - cite.t_start)).toBeLessThan(2);

    await page.evaluate(() => {
      const el = document.querySelector<HTMLAudioElement>("audio");
      el?.pause();
    });
    await expect(page.locator("main").getByText("Paused", { exact: true })).toBeVisible();
  });
});