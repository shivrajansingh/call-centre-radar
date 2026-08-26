import { expect, test } from "@playwright/test";
import { apiGet, login, waitForTableIdle } from "../helpers";

test.describe("TC-26 — Customer directory renders and search filters it", () => {
  test("directory table, client-side search and empty state", async ({ page }) => {
    await login(page);
    await page.goto("/customers");
    await waitForTableIdle(page);

    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.getByText(/customers · \d+ shown/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Register customer/ })).toBeVisible();

    const headers = (await page.locator("table thead th").allInnerTexts()).map(h => h.toUpperCase());
    expect(headers).toEqual([
      "CUSTOMER", "CALLS", "UNRESOLVED", "AVG ATTENTION", "AVG QA STARS", "LAST CALL",
    ]);

    const customers = (await apiGet(page, "/customers")).customers as {
      id: number;
      name: string;
      call_count: number;
      avg_attention: number | null;
      avg_review_stars: number | null;
    }[];
    const mary = customers.find(c => c.name === "Mary Smith");
    expect(mary).toBeDefined();

    const row = page.locator("tbody tr").filter({ hasText: "Mary Smith" });
    await expect(row).toHaveCount(1);
    await expect(row.locator("td").nth(0).getByRole("link")).toHaveAttribute(
      "href",
      `/customers/${mary!.id}`,
    );
    await expect(row.locator("td").nth(1)).toHaveText(String(mary!.call_count));

    const search = page.getByPlaceholder("Search customers…");
    const maryCount = customers.filter(c => c.name.toLowerCase().includes("mary")).length;
    expect(maryCount).toBeGreaterThan(0);
    await search.fill("Mary");
    await expect(page.getByText(new RegExp(`customers · ${maryCount} shown`))).toBeVisible();
    const filtered = page.locator("tbody tr");
    for (let i = 0; i < maryCount; i++) {
      await expect(filtered.nth(i)).toContainText(/Mary/i);
    }

    await search.fill("zzz");
    await expect(page.getByText("0 shown")).toBeVisible();
    await expect(page.getByText("No customers")).toBeVisible();

    await search.fill("");
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });
});