import { expect, test } from "@playwright/test";
import { AUDIO_FIXTURE, login } from "../helpers";

test.describe("TC-36 — Invalid metadata JSON blocks upload", () => {
  test("malformed JSON shows an error and disables the button", async ({ page }) => {
    await login(page);
    await page.goto("/upload");

    const input = page.locator('input[type="file"]');
    const uploadBtn = page.getByRole("button", { name: /^Upload/ });
    await input.setInputFiles(AUDIO_FIXTURE);
    await expect(uploadBtn).toBeEnabled();

    const metadata = page.getByPlaceholder('{"session": "…", "start_time_ms": …, "labels": {"caller_mos": …}}');
    await metadata.fill('{"session": oops');
    await expect(page.getByText("metadata must be valid JSON")).toBeVisible();
    await expect(uploadBtn).toBeDisabled();

    await metadata.fill('{"session": "e2e", "labels": {"caller_mos": 4}}');
    await expect(page.getByText("metadata must be valid JSON")).toHaveCount(0);
    await expect(uploadBtn).toBeEnabled();
  });
});