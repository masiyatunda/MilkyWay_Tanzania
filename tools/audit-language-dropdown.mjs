import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const { chromium } = await import(process.env.MW_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const origin = process.env.MW_AUDIT_ORIGIN || 'http://localhost:8889';
const output = '/tmp/milkyway-language-audit';
await mkdir(output, { recursive: true });
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message);checks++; };
try {
  for (const width of [360, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/functions/v1/livekit-token', route => route.fulfill({ json: { available: true, reason: 'configuration_present', service: 'supabase' } }));
    await page.route('**/api/milkyway-discovery', route => route.fulfill({ json: { sessions: [] } }));
    await page.goto(`${origin}/milkyway/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#langSelTrigger');
    for (const identity of ['langSel', 'mwLiveLanguage']) {
      if (identity === 'mwLiveLanguage') await page.evaluate(() => window.MilkyWayLive.open());
      const trigger = page.locator(`#${identity}Trigger`);
      const list = page.locator(`#${identity}Options`);
      await trigger.click();
      check(await list.isVisible(), `menu opens at ${width}px`);
      check(JSON.stringify(await list.locator('[role="option"]').allTextContents()) === JSON.stringify(['Kiswahili', 'English', 'Français', '中文']), 'four original languages remain');
      const bounds = await list.boundingBox();
      const anchor = await trigger.boundingBox();
      check(bounds.height < 210 && bounds.width < 180, 'menu remains compact');
      check(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= anchor.y + anchor.height, 'menu is anchored beneath the selector inside the viewport');
      check(await page.locator(`#${identity}`).isHidden(), 'native selection sheet is disabled');
      await list.locator('[data-language="fr"]').click();
      check(await list.isHidden(), 'selection closes menu immediately');
      check(await page.evaluate(() => window.MilkyWayI18n.language()) === 'fr', 'selection updates existing translation system');
      check((await trigger.getAttribute('aria-label')).includes('Français'), 'accessible label identifies selected language');
      await trigger.click();
      check(await list.locator('[data-language="fr"]').getAttribute('aria-selected') === 'true', 'selected row is highlighted');
      await page.keyboard.press('Escape');
      check(await list.isHidden(), 'Escape closes menu');
      check(await trigger.evaluate(element => element === document.activeElement), 'Escape restores trigger focus');
      await trigger.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
      check(await page.evaluate(() => window.MilkyWayI18n.language()) === 'en', 'keyboard arrows and Enter update language');
      check(await list.isHidden(), 'keyboard selection closes menu');
      await trigger.click();await page.mouse.click(12, 750);
      check(await list.isHidden(), 'outside tap closes menu');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'menu adds no horizontal scrolling');
      await trigger.click();
      await page.screenshot({ path: `${output}/${identity}-${width}.png` });
      await page.keyboard.press('Escape');
    }
    check(await page.locator('#mwLiveType option').allTextContents().then(options => options.length === 3), 'host can choose both Live types');
    check(await page.locator('#mwLiveType').getAttribute('required') !== null, 'host must choose a Live type');
    await page.locator('#mwLiveLanguageTrigger').click();
    await page.evaluate(() => window.dispatchEvent(new Event('hashchange')));
    check(await page.locator('#mwLiveLanguageOptions').isHidden(), 'navigation closes menu');
    await page.locator('#mwLiveLanguageTrigger').press('Escape');
    check(await page.locator('#mwLivePage').isHidden(), 'Escape still closes Live when no language menu is open');
    check(errors.length === 0, `no browser runtime errors: ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`${checks} mobile and desktop language/Live setup checks passed (mocked Live availability; no call claimed).`);
} finally { await browser.close(); }
