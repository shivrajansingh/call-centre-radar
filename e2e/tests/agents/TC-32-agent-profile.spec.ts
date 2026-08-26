import { expect, test } from "@playwright/test";
import { apiGet, kpiValue, login, SID_WITH_REVIEW, waitForTableIdle } from "../helpers";

test.describe("TC-32 — Agent profile shows stats and calls handled", () => {
  test("profile stats match the API and table rows navigate", async ({ page }) => {
    await login(page);
    const ag = await apiGet(page, "/agents/1");
    const s = ag.stats;

    await page.goto("/agents/1");
    await waitForTableIdle(page);

    await expect(page.locator("main").getByRole("link", { name: "Agents" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Robert" })).toBeVisible();
    await expect(page.getByText(`${s.call_count} calls handled`)).toBeVisible();

    expect(await kpiValue(page, "Calls handled")).toBe(String(s.call_count));

    if (s.avg_handle_time_s != null) {
      expect(await kpiValue(page, "Avg handle time")).toBe(`${Math.round(s.avg_handle_time_s)}s`);
    }

    if (s.resolution_rate != null) {
      expect(await kpiValue(page, "Resolution rate")).toBe(
        `${Math.round(s.resolution_rate * 100)}%`,
      );
    }

    const rate = s.call_count ? Math.round((s.mood_shifts / s.call_count) * 100) : 0;
    expect(await kpiValue(page, "Mood-shift rate")).toBe(`${rate}%`);

    await expect(page.getByRole("heading", { name: "Calls handled" })).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(ag.calls.length);

    const target = ag.calls.find((c: { sid: string }) => c.sid === SID_WITH_REVIEW);
    if (target) {
      const row = rows.filter({ hasText: target.intent_label ?? target.sid });
      await row.locator("td").nth(3).click();
      await expect(page).toHaveURL(`/calls/${SID_WITH_REVIEW}`);

      await page.goto("/agents/1");
      await page.locator("tbody tr").filter({ hasText: target.intent_label ?? target.sid })
        .locator("td").nth(1).getByRole("link").click();
      await expect(page).toHaveURL(/\/customers\/1$/);
    }
  });
});