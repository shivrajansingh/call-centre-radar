import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { AUDIO_FIXTURE, login } from "../helpers";

const tmpDir = path.resolve(__dirname, "../../fixtures");

test.describe("TC-37 — Successful upload queues the call", () => {
  test("upload shows a queued toast, done panel and a view-call link", async ({ page }) => {
    const tmpFile = path.join(tmpDir, `e2e-upload-${Date.now()}.mp3`);
    fs.copyFileSync(AUDIO_FIXTURE, tmpFile);
    const filename = path.basename(tmpFile);
    const sid = filename.replace(/\.mp3$/, "");

    try {
      await login(page);
      await page.goto("/upload");

      const input = page.locator('input[type="file"]');
      await input.setInputFiles(tmpFile);
      const uploadBtn = page.getByRole("button", { name: /^Upload \(1 file\)/ });
      await page.getByPlaceholder("Jane Doe").fill("E2E Caller");
      await page.getByPlaceholder("Sam Carter").fill("E2E Agent");
      await uploadBtn.click();

      await expect(page.getByText(new RegExp(`^${filename} queued \\(${sid}\\)$`))).toBeVisible();

      await expect(page.getByText("1 call queued")).toBeVisible();
      const viewLink = page.getByRole("button", { name: "view call →" });
      await expect(viewLink).toBeVisible();

      await expect(uploadBtn).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Upload" })).toBeDisabled();

      await viewLink.click();
      await expect(page).toHaveURL(`/calls/${sid}`);
      await expect(
        page.getByRole("heading", { name: "E2E Caller with E2E Agent" }),
      ).toBeVisible();
      await expect(page.locator("main")).toContainText(sid);
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  });
});