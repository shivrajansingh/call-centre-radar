import { expect, test } from "@playwright/test";
import { apiGet, kpiValue, login, SID_WITH_REVIEW, waitForTableIdle } from "../helpers";

test.describe("TC-28 — Customer profile shows KPIs and full call history", () => {
  test("profile stats match the API and history rows navigate", async ({ page }) => {
    await login(page);
    const cu = await apiGet(page, "/customers/1");
    const s = cu.stats;

    await page.goto("/customers/1");
    await waitForTableIdle(page);

    await expect(page.locator("main").getByRole("link", { name: "Customers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mary Smith" })).toBeVisible();
    await expect(page.getByText(`${s.call_count} calls in total`)).toBeVisible();

    expect(await kpiValue(page, "Total calls")).toBe(String(s.call_count));

    const known = (s.resolved_count ?? 0) + (s.unresolved_count ?? 0);
    const rate = known ? Math.round((s.resolved_count / known) * 100) : null;
    if (rate != null) {
      expect(await kpiValue(page, "Resolution rate")).toBe(`${rate}%`);
    }
    await expect(page.getByText(/resolved · \d+ unresolved/)).toBeVisible();

    if (s.avg_attention != null) {
      expect(await kpiValue(page, "Avg attention")).toBe(String(s.avg_attention));
    }

    await expect(page.getByRole("heading", { name: "Call history" })).toBeVisible();
    await expect(page.getByText("newest first")).toBeVisible();

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(cu.calls.length);

    const target = cu.calls.find((c: { sid: string }) => c.sid === SID_WITH_REVIEW);
    if (target) {
      const row = rows.filter({ hasText: target.intent_label ?? target.sid });
      await row.locator("td").nth(2).click();
      await expect(page).toHaveURL(`/calls/${SID_WITH_REVIEW}`);

      await page.goto("/customers/1");
      await page.locator("tbody tr").filter({ hasText: target.intent_label ?? target.sid })
        .locator("td").nth(1).getByRole("link").click();
      await expect(page).toHaveURL(/\/agents\/1$/);
    }
  });
});