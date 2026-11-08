import { test, expect } from '@playwright/test';
for (const [width, height] of [[320,800],[390,900],[768,1024],[1360,1080]]) {
 test(`shell reflows at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height});
  await page.goto('/');
  await expect(page.getByRole('heading', {name:/Sell a covered call/})).toBeVisible();
  await expect(page.getByText('Live trading is unavailable', {exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(await page.locator('body').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', {name:'Skip to content'})).toBeFocused();
  await page.screenshot({path:`.local/screenshots/shell-${width}.png`,fullPage:true});
 });
}
