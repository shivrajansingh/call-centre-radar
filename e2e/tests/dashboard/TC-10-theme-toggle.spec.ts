import { expect, test } from "@playwright/test";
import { login } from "../helpers";

test.describe("TC-10 — Theme toggle switches dark ↔ light and persists", () => {
  test("toggles, persists in localStorage and survives reload", async ({ page }) => {
    await login(page);

    const toggle = page.locator("header button[title]");
    await expect(toggle).toHaveAttribute("title", "Switch to light mode");
    expect(await page.getAttribute("html", "data-theme")).toBe("dark");

    await toggle.click();
    await expect(toggle).toHaveAttribute("title", "Switch to dark mode");
    expect(await page.evaluate(() => localStorage.getItem("radar_theme"))).toBe("light");
    expect(await page.getAttribute("html", "data-theme")).toBe("light");

    await page.reload();
    await expect(toggle).toHaveAttribute("title", "Switch to dark mode");
    expect(await page.getAttribute("html", "data-theme")).toBe("light");

    await toggle.click();
    await expect(toggle).toHaveAttribute("title", "Switch to light mode");
    expect(await page.evaluate(() => localStorage.getItem("radar_theme"))).toBe("dark");

    await page.goto("/calls");
    await expect(toggle).toHaveAttribute("title", "Switch to light mode");
  });
});