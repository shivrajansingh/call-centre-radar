import { expect, test } from "@playwright/test";
import { apiGet, login, SID_WITH_REVIEW } from "../helpers";

test.describe("TC-20 — Transcript turns render with speakers and timestamps", () => {
  test("turn list matches the API and clicks seek the audio", async ({ page }) => {
    await login(page);
    await page.goto(`/calls/${SID_WITH_REVIEW}`);

    const detail = await apiGet(page, `/calls/${SID_WITH_REVIEW}`);
    const turns = detail.turns;

    await expect(
      page.getByRole("heading", { name: "Recording & transcript" }),
    ).toBeVisible();

    const rows = page.locator(".transcript > div");
    await expect(rows).toHaveCount(turns.length);

    await expect(rows.first()).toContainText(`${turns[0].start.toFixed(1)}s`);
    await expect(rows.first()).toContainText("Agent");
    await expect(rows.first()).toContainText(turns[0].text);

    const labels: string[] = [];
    for (let i = 0; i < turns.length; i++) {
      const t = await rows.nth(i).innerText();
      labels.push(t);
      expect(t).toMatch(/^\d+\.\d+s\n(Agent|Caller)\n/);
      await expect(rows.nth(i)).toContainText(`${turns[i].start.toFixed(1)}s`);
    }
    for (let i = 1; i < turns.length; i++) {
      expect(turns[i].start).toBeGreaterThanOrEqual(turns[i - 1].start);
    }

    const target = turns[2];
    await rows.nth(2).click();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector<HTMLAudioElement>("audio");
          return el ? el.currentTime : 0;
        }),
      )
      .toBeGreaterThan(target.start - 1.5);
  });
});