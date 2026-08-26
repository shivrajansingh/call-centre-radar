import { expect, test } from "@playwright/test";
import { login, SID_WITH_REVIEW } from "../helpers";

test.describe("TC-15 — Row click and customer/agent links navigate", () => {
  test("row click opens the call; links open customer and agent profiles", async ({ page }) => {
    await login(page);
    await page.goto("/calls");

    const search = page.getByPlaceholder("Search customer, agent, intent, call ID…");
    await search.fill(SID_WITH_REVIEW);
    await search.press("Enter");
    const row = page.locator("tbody tr");
    await expect(row).toHaveCount(1);

    await row.first().locator("td").nth(3).click();
    await expect(page).toHaveURL(`/calls/${SID_WITH_REVIEW}`);
    await expect(page.getByRole("heading", { name: "Mary Smith with Robert" })).toBeVisible();

    await page.goto("/calls");
    await search.fill(SID_WITH_REVIEW);
    await search.press("Enter");
    await row.first().locator("td").nth(1).getByRole("link").click();
    await expect(page).toHaveURL(/\/customers\/1$/);
    await expect(page.getByRole("heading", { name: "Mary Smith" })).toBeVisible();

    await page.goto("/calls");
    await search.fill(SID_WITH_REVIEW);
    await search.press("Enter");
    await row.first().locator("td").nth(2).getByRole("link").click();
    await expect(page).toHaveURL(/\/agents\/1$/);
    await expect(page.getByRole("heading", { name: "Robert" })).toBeVisible();
  });
});