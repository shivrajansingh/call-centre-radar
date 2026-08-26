import { expect, test } from "@playwright/test";
import { login, waitForTableIdle } from "../helpers";

test.describe("TC-11 — Calls table renders rows and paginates", () => {
  test("25 rows, ordered headers, working Prev/Next", async ({ page }) => {
    await login(page);
    await page.goto("/calls");

    await expect(page.getByRole("heading", { name: "Calls" })).toBeVisible();
    await expect(page.getByText(/25 shown · sorted by recency/)).toBeVisible();

    const headers = (await page.locator("table thead th").allInnerTexts()).map(h => h.toUpperCase());
    expect(headers).toEqual([
      "DATE", "CUSTOMER", "AGENT", "INTENT", "STATUS", "SCORE", "MOOD", "QA", "HANDLE",
    ]);

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(25);

    const first = rows.first().locator("td");
    await expect(first.nth(1).getByRole("link")).toBeVisible();
    await expect(first.nth(2).getByRole("link")).toBeVisible();
    await expect(first.nth(8)).toHaveText(/\d+s|–/);

    const prev = page.getByRole("button", { name: "Prev" });
    const next = page.getByRole("button", { name: "Next" });
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();

    const firstRowCustomer = await rows.first().locator("td").nth(1).innerText();
    await next.click();
    await expect(page.getByText("page 2")).toBeVisible();
    await waitForTableIdle(page);
    const n2 = await rows.count();
    expect(n2).toBeGreaterThan(0);
    expect(n2).toBeLessThanOrEqual(25);
    expect(await rows.first().locator("td").nth(1).innerText()).not.toBe(firstRowCustomer);

    await prev.click();
    await expect(page.getByText("page 1")).toBeVisible();
    await expect(rows.first().locator("td").nth(1)).toHaveText(firstRowCustomer);
    await expect(prev).toBeDisabled();
  });
});