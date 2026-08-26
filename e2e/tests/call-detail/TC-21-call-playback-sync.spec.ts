import { expect, test } from "@playwright/test";
import { login, seekAudio, SID_WITH_REVIEW } from "../helpers";

test.describe("TC-21 — Playback drives playing indicator, active-turn and word highlight", () => {
  test("play state, clock, active turn and «word» markers follow the audio", async ({ page }) => {
    await login(page);
    await page.goto(`/calls/${SID_WITH_REVIEW}`);

    const pill = page.locator("main").getByText("Paused", { exact: true });
    await expect(pill).toBeVisible();

    await page.evaluate(() => {
      const el = document.querySelector<HTMLAudioElement>("audio");
      void el?.play();
    });
    await expect(page.locator("main").getByText("Playing", { exact: true })).toBeVisible();

    await seekAudio(page, 41);
    await page.evaluate(() => {
      const el = document.querySelector<HTMLAudioElement>("audio");
      el?.pause();
    });
    await expect(page.locator("main").getByText(/^0:41 \//)).toBeVisible();
    await expect(page.locator("main").getByText("Paused", { exact: true })).toBeVisible();

    const active = page.locator(".transcript > div.active");
    await expect(active).toHaveCount(1);
    await expect(active).toContainText(/Agent|Caller/);
    await expect(active).toContainText("«");
    await expect(active).toContainText("»");

    await seekAudio(page, 0);
    await expect(page.locator("main").getByText(/^0:00 \//)).toBeVisible();
  });
});