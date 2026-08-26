import { expect, test } from "@playwright/test";
import { apiGet, login, waitForTableIdle } from "../helpers";

test.describe("TC-30 — Agent leaderboard renders and search filters it", () => {
  test("headers, volume ranking and client-side search", async ({ page }) => {
    await login(page);
    await page.goto("/agents");
    await waitForTableIdle(page);

    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
    await expect(page.getByText(/agents · ranked by volume/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Register agent/ })).toBeVisible();

    const headers = (await page.locator("table thead th").allInnerTexts()).map(h => h.toUpperCase());
    expect(headers).toEqual([
      "AGENT", "VOLUME", "HANDLE TIME", "RESOLUTION RATE", "AVG ATTENTION",
      "MOOD SHIFTS", "AVG QA STARS",
    ]);

    const rows = page.locator("tbody tr");
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);

    const volumes: number[] = [];
    for (let i = 0; i < n; i++) {
      volumes.push(Number(await rows.nth(i).locator("td").nth(1).locator("span").last().innerText()));
    }
    for (let i = 1; i < volumes.length; i++) {
      expect(volumes[i]).toBeLessThanOrEqual(volumes[i - 1]);
    }

    const search = page.getByPlaceholder("Search agents…");
    const agents = (await apiGet(page, "/agents")).agents as { name: string }[];
    const robertCount = agents.filter(a => a.name.toLowerCase().includes("robert")).length;
    expect(robertCount).toBeGreaterThan(0);
    await search.fill("Robert");
    await expect(page.locator("tbody tr")).toHaveCount(robertCount);
    for (let i = 0; i < robertCount; i++) {
      await expect(page.locator("tbody tr").nth(i)).toContainText(/Robert/i);
    }

    await search.fill("zzz");
    await expect(page.locator("tbody tr")).toHaveCount(0);

    await search.fill("");
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });
});