import { expect, test } from "@playwright/test";
import { apiDeleteAllReviews, login, SID_CLEAN } from "../helpers";

test.describe("TC-22 — QA review: save a rating with note", () => {
  test("saves a 4-star review with a note and shows it in the list", async ({ page }) => {
    await login(page);
    await apiDeleteAllReviews(page, SID_CLEAN);
    await page.goto(`/calls/${SID_CLEAN}`);

    const card = page
      .getByRole("heading", { name: "QA review" })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const form = card.locator("form");
    const list = card.locator("div.grid.content-start.gap-2").last();

    await expect(list.getByText("No QA reviews yet")).toBeVisible();

    await form.getByTitle("4 stars").click();
    await expect(form.getByText("4/5", { exact: true })).toBeVisible();

    await form
      .getByPlaceholder("Notes for the agent (optional)…")
      .fill("Great de-escalation.");

    await form.getByRole("button", { name: /Save review|Update review/ }).click();

    await expect(page.getByText("Review saved")).toBeVisible();
    await expect(list.getByText("Administrator")).toBeVisible();
    await expect(list.getByText("Great de-escalation.")).toBeVisible();
    await expect(list.locator("button[title='Delete review']")).toBeVisible();
    await expect(form.getByRole("button", { name: "Update review" })).toBeVisible();

    await list.locator("button[title='Delete review']").click();
    await expect(page.getByText("Review deleted")).toBeVisible();
    await expect(list.getByText("No QA reviews yet")).toBeVisible();
  });
});