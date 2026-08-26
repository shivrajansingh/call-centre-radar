import { expect, test } from "@playwright/test";
import { apiGet, login, SID_WITH_REVIEW } from "../helpers";

test.describe("TC-25 — Customer survey card renders when data exists", () => {
  test("survey card appears for a surveyed call and is absent for dataset calls", async ({ page }) => {
    await login(page);

    const calls = (await apiGet(page, "/calls?limit=200")).calls as {
      sid: string;
      survey_ease: number | null;
      survey_partner: number | null;
      caller_mos: number | null;
    }[];
    const withSurvey = calls.find(
      c => c.survey_ease != null || c.survey_partner != null || c.caller_mos != null,
    );

    if (withSurvey) {
      await page.goto(`/calls/${withSurvey.sid}`);
      const card = page
        .getByText("Customer survey", { exact: true })
        .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
      await expect(card).toBeVisible();
      if (withSurvey.survey_ease != null) {
        await expect(card.getByText(`Ease of connection ${withSurvey.survey_ease}/10`)).toBeVisible();
      }
      if (withSurvey.survey_partner != null) {
        await expect(card.getByText(`Partner rating ${withSurvey.survey_partner}/10`)).toBeVisible();
      }
      if (withSurvey.caller_mos != null) {
        await expect(card.getByText(`MOS ${withSurvey.caller_mos}`)).toBeVisible();
      }
    }

    await page.goto(`/calls/${SID_WITH_REVIEW}`);
    await expect(page.getByText("Customer survey", { exact: true })).toHaveCount(0);
  });
});