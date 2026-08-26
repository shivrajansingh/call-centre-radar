import { expect, test } from "@playwright/test";
import { apiGet, kpiValue, login } from "../helpers";

test.describe("TC-06 — Dashboard KPI cards render with correct values", () => {
  test("KPI cards match the /kpis payload", async ({ page }) => {
    await login(page);
    const kpis = await apiGet(page, "/kpis");

    await expect(page.getByRole("heading", { name: "Operations dashboard" })).toBeVisible();
    await expect(
      page.getByText(`Live view across all ${kpis.total_calls} recorded calls`),
    ).toBeVisible();

    const total = await kpiValue(page, "Total calls");
    expect(total).toBe(String(kpis.total_calls));
    await expect(
      page.locator("div.min-w-0.rounded-xl").filter({ hasText: "Total calls" }),
    ).toContainText(`${kpis.transcribed} transcribed · ${kpis.analyzed} analyzed`);

    const resolved = kpis.resolution_split.resolved ?? 0;
    const unresolved = kpis.resolution_split.unresolved ?? 0;
    const analyzed = kpis.analyzed || 0;
    const rate = analyzed ? Math.round((resolved / analyzed) * 100) : 0;
    expect(await kpiValue(page, "Resolution rate")).toBe(`${rate}%`);
    await expect(
      page.locator("div.min-w-0.rounded-xl").filter({ hasText: "Resolution rate" }),
    ).toContainText(`${resolved} resolved · ${unresolved} unresolved`);

    if (kpis.avg_handle_time_s != null) {
      expect(await kpiValue(page, "Avg handle time")).toBe(
        `${Math.round(kpis.avg_handle_time_s)}s`,
      );
    }

    if (kpis.avg_survey_ease != null) {
      expect(await kpiValue(page, "Avg survey rating")).toBe(
        kpis.avg_survey_ease.toFixed(1),
      );
    }

    if (kpis.avg_attention.critical > 0) {
      await expect(page.getByText(`${kpis.avg_attention.critical} critical`)).toBeVisible();
    }
  });
});