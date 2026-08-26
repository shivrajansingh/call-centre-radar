import { expect, test } from "@playwright/test";
import { AUDIO_FIXTURE, fileRows, login, TEXT_FIXTURE } from "../helpers";

test.describe("TC-35 — Non-audio files are rejected with a toast", () => {
  test("a .txt file is dropped with a toast; mixed selection keeps only audio", async ({ page }) => {
    await login(page);
    await page.goto("/upload");

    const input = page.locator('input[type="file"]');
    const uploadBtn = page.getByRole("button", { name: /^Upload/ });

    await input.setInputFiles(TEXT_FIXTURE);
    await expect(page.getByText("Only audio files are supported")).toBeVisible();
    await expect(uploadBtn).toHaveText("Upload");
    await expect(uploadBtn).toBeDisabled();

    await input.setInputFiles([TEXT_FIXTURE, AUDIO_FIXTURE]);
    await expect(fileRows(page)).toHaveCount(1);
    await expect(uploadBtn).toHaveText("Upload (1 file)");
  });
});