import { expect, test } from "@playwright/test";
import { ensureUser, login, logoutViaMenu } from "../helpers";

test.describe("TC-33 — Upload is role-gated (agent blocked, manager allowed)", () => {
  test("admin sees Upload; agent is redirected; manager has access", async ({ page }) => {
    await login(page);
    await ensureUser(page, "E2E Agent User", "e2eagent", "e2eagent123", "agent");
    await ensureUser(page, "E2E Manager User", "e2emanager", "e2emanager123", "manager");

    await expect(page.locator("aside").getByRole("link", { name: "Upload" })).toBeVisible();
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Upload recordings" })).toBeVisible();

    await logoutViaMenu(page);
    await login(page, "e2eagent", "e2eagent123");
    await expect(page.locator("aside").getByRole("link", { name: "Upload" })).toHaveCount(0);
    await expect(page.locator("aside").getByRole("link", { name: "Users" })).toHaveCount(0);
    await page.goto("/upload");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Operations dashboard" })).toBeVisible();

    await logoutViaMenu(page);
    await login(page, "e2emanager", "e2emanager123");
    await expect(page.locator("aside").getByRole("link", { name: "Upload" })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: "Users" })).toHaveCount(0);
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Upload recordings" })).toBeVisible();
  });
});