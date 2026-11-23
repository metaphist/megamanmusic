// Credit: every page credits Capcom for the music and art in its footer
import { test, expect } from "@playwright/test";

for (const path of ["index.html", "robot-master.html", "tiers.html", "colors.html", "colors-classic.html"]) {
  test(`${path} credits Capcom in its footer`, async ({ page }) => {
    await page.goto(`/${path}`);
    const credit = page.locator("footer.site-foot [data-testid=capcom-credit]");
    await expect(credit).toBeVisible();
    await expect(credit).toContainText("© Capcom");
  });
}
