import { expect, test } from "@playwright/test";
import { login } from "../helpers";

test.describe("TC-09 — Charts and quick stats render", () => {
  test("chart cards and the quick-stats grid are present", async ({ page }) => {
    await login(page);

    await expect(
      page.getByRole("heading", { name: "Calls over time" }),
    ).toBeVisible();
    await expect(page.getByText("last 14 days · unresolved overlay")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Resolution split" })).toBeVisible();
    await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Customer mood mix" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Quick stats" })).toBeVisible();
    for (const label of [
      "Avg attention score",
      "Critical calls (≥70)",
      "QA reviews filed",
      "Avg QA stars",
      "Survey (ease of connection)",
      "Processing errors",
    ]) {
      await expect(page.locator("main").getByText(label, { exact: true })).toBeVisible();
    }

    const svgs = await page.locator("main svg").count();
    expect(svgs).toBeGreaterThanOrEqual(2);
  });
});