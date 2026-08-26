import { expect, test } from "@playwright/test";
import { AUDIO_FIXTURE, AUDIO_FIXTURE_2, fileRows, login } from "../helpers";

test.describe("TC-34 — Files added to the queue with size and remove", () => {
  test("file rows show name, size, remove; button label tracks the count", async ({ page }) => {
    await login(page);
    await page.goto("/upload");

    await expect(page.getByText("Drop call recordings here")).toBeVisible();

    const input = page.locator('input[type="file"]');
    const uploadBtn = page.getByRole("button", { name: /^Upload/ });

    await input.setInputFiles(AUDIO_FIXTURE);
    await expect(fileRows(page)).toHaveCount(1);
    await expect(fileRows(page).first()).toContainText(AUDIO_FIXTURE.split("/").pop()!);
    await expect(fileRows(page).first()).toContainText(/KB/);
    await expect(uploadBtn).toHaveText("Upload (1 file)");
    await expect(uploadBtn).toBeEnabled();

    await input.setInputFiles([AUDIO_FIXTURE, AUDIO_FIXTURE_2]);
    await expect(fileRows(page)).toHaveCount(3);
    await expect(uploadBtn).toHaveText("Upload (3 files)");

    await fileRows(page).first().getByRole("button").click();
    await expect(fileRows(page)).toHaveCount(2);
    await expect(uploadBtn).toHaveText("Upload (2 files)");

    await fileRows(page).first().getByRole("button").click();
    await expect(fileRows(page)).toHaveCount(1);
    await expect(uploadBtn).toHaveText("Upload (1 file)");

    await fileRows(page).first().getByRole("button").click();
    await expect(fileRows(page)).toHaveCount(0);
    await expect(uploadBtn).toHaveText("Upload");
    await expect(uploadBtn).toBeDisabled();
  });
});