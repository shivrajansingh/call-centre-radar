import { expect, test } from "@playwright/test";
import { apiDeleteAllReviews, login, SID_CLEAN } from "../helpers";

test.describe("TC-23 — QA review: zero stars blocked; own review deletable", () => {
  test("blocks 0-star saves and deletes the user's own review", async ({ page }) => {
    await login(page);
    await apiDeleteAllReviews(page, SID_CLEAN);
    await page.goto(`/calls/${SID_CLEAN}`);

    const card = page
      .getByRole("heading", { name: "QA review" })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const form = card.locator("form");
    const list = card.locator("div.grid.content-start.gap-2").last();

    await expect(list.getByText("No QA reviews yet")).toBeVisible();

    await form.getByRole("button", { name: "Save review" }).click();
    await expect(page.getByText("Pick a star rating")).toBeVisible();
    await expect(list.getByText("No QA reviews yet")).toBeVisible();

    await form.getByTitle("3 stars").click();
    await form.getByPlaceholder("Notes for the agent (optional)…").fill("E2E note");
    await form.getByRole("button", { name: "Save review" }).click();
    await expect(page.getByText("Review saved")).toBeVisible();
    await expect(list.getByText("Administrator")).toBeVisible();

    await list.locator("button[title='Delete review']").click();
    await expect(page.getByText("Review deleted")).toBeVisible();
    await expect(list.getByText("No QA reviews yet")).toBeVisible();
    await expect(form.getByRole("button", { name: "Save review" })).toBeVisible();
  });
});