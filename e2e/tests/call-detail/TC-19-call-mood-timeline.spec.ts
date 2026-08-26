import { expect, test } from "@playwright/test";
import { apiGet, login, SID_WITH_REVIEW } from "../helpers";

test.describe("TC-19 — Mood timeline renders shift marker and seeks on click", () => {
  test("dots + shift marker match the analysis; clicks seek the audio", async ({ page }) => {
    await login(page);
    await page.goto(`/calls/${SID_WITH_REVIEW}`);

    const a = (await apiGet(page, `/calls/${SID_WITH_REVIEW}`)).analysis;

    const card = page
      .getByRole("heading", { name: "Mood timeline" })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await expect(card).toBeVisible();
    await expect(card.getByText(a.mood_start).first()).toBeVisible();
    await expect(card.getByText(a.mood_end).first()).toBeVisible();

    await expect(card.locator(".tl-dot")).toHaveCount(a.mood_timeline.length);

    const shift = card.locator(".tl-shift");
    await expect(shift).toBeVisible();
    await expect(shift).toHaveAttribute(
      "title",
      `mood shifted ${a.mood_shift_from} → ${a.mood_shift_to} @ ${a.mood_shift_t.toFixed(1)}s — click to hear`,
    );
    await expect(card.getByText(`Shift to ${a.mood_shift_to} at ${Math.round(a.mood_shift_t)}s`)).toBeVisible();

    const shiftCite = card.locator("button", { hasText: `@${Math.round(a.mood_shift_t)}s` });
    const title = await shiftCite.getAttribute("title");
    expect(title).toContain(a.mood_shift_citation.quote);

    await shift.click();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector<HTMLAudioElement>("audio");
          return el ? el.currentTime : 0;
        }),
      )
      .toBeGreaterThan(a.mood_shift_t - 2);

    const firstDot = card.locator(".tl-dot").first();
    const firstT = a.mood_timeline[0].t;
    await firstDot.click();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector<HTMLAudioElement>("audio");
          return el ? el.currentTime : 0;
        }),
      )
      .toBeGreaterThan(firstT - 2);
    await expect(page.locator("main").getByText("Playing", { exact: true })).toBeVisible();
  });
});