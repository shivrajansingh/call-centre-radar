import { expect, Page } from "@playwright/test";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

export const ADMIN = { username: "admin", password: "admin123" };

export const AUDIO_FIXTURE = path.join(ROOT, "data/audio/004860b1ab2e4c88.mp3");
export const AUDIO_FIXTURE_2 = path.join(ROOT, "data/audio/ff0296d00e5e4184.mp3");
export const TEXT_FIXTURE = path.join(ROOT, "e2e/fixtures/not-an-audio.txt");

export const SID_WITH_REVIEW = "004860b1ab2e4c88";
export const SID_CLEAN = "01f7ec3700424bc0";

export const getToken = (page: Page) =>
  page.evaluate(() => localStorage.getItem("radar_token"));

export async function apiGet(page: Page, path: string) {
  const token = await getToken(page);
  const res = await page.request.get(`http://localhost:8100${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

export async function apiDeleteAllReviews(page: Page, sid: string) {
  const token = await getToken(page);
  const { reviews } = await apiGet(page, `/calls/${sid}/reviews`);
  for (const r of reviews) {
    await page.request.delete(`http://localhost:8100/calls/${sid}/reviews/${r.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
}

export async function ensureUser(
  page: Page,
  name: string,
  username: string,
  password: string,
  role: string,
) {
  const token = await getToken(page);
  const auth = { Authorization: `Bearer ${token}` };
  const { users } = await apiGet(page, "/users");
  const existing = users.find((u: { username: string }) => u.username === username);
  if (existing) {
    await page.request.patch(`http://localhost:8100/users/${existing.id}`, {
      form: { active: "1" },
      headers: auth,
    });
    return existing.id as number;
  }
  const res = await page.request.post("http://localhost:8100/users", {
    form: { name, username, password, role },
    headers: auth,
  });
  if (!res.ok()) throw new Error(`ensureUser failed: ${res.status()} ${await res.text()}`);
  return (await res.json()).id as number;
}

export const fileRows = (page: Page) =>
  page.locator('div[class*="rounded-lg"]', { hasText: /KB/ });

export async function waitForTableIdle(page: Page) {
  await expect
    .poll(async () => {
      const spinner = await page.locator("main svg.animate-spin").count();
      if (spinner > 0) return false;
      const rows = await page.locator("tbody tr").count();
      if (rows > 0) return true;
      return await page.getByText("No calls match").isVisible().catch(() => false);
    }, { timeout: 10_000 })
    .toBe(true);
}

export async function kpiValue(page: Page, label: string) {
  const card = page.locator("div.min-w-0.rounded-xl").filter({ hasText: label });
  return card.locator('div[class*="mt-1.5"]').first().innerText();
}

export async function login(
  page: Page,
  username = ADMIN.username,
  password = ADMIN.password,
) {
  await page.goto("/login");
  await page.getByPlaceholder("admin").fill(username);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

export async function attemptLogin(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("admin").fill(username);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function logoutViaMenu(page: Page) {
  await page.locator("header .relative button").first().click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
}

export async function seekAudio(page: Page, t: number) {
  await page.evaluate((sec) => {
    const el = document.querySelector<HTMLAudioElement>("audio");
    if (!el) return;
    el.currentTime = sec;
    el.dispatchEvent(new Event("timeupdate"));
  }, t);
}

export const playingPill = (page: Page) =>
  page.locator("main").getByText(/^(Playing|Paused)$/).first();

export function audioState(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLAudioElement>("audio");
    return el ? { currentTime: el.currentTime, paused: el.paused } : null;
  });
}