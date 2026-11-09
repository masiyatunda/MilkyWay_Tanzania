import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = await import(process.env.MW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.MW_AUDIT_ORIGIN || 'http://localhost:8889';
const output = resolve(process.env.MW_AUDIT_OUTPUT || '/tmp/milkyway-theme-audit');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.MW_CHROMIUM_PATH ? { executablePath: process.env.MW_CHROMIUM_PATH } : {}) });
const failures = [];
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };

try {
  for (const width of [360, 390, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('mw_appearance', 'galaxy'));
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(`${origin}/milkyway/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.mwAppearance === 'galaxy' && window.MilkyWayI18n);
    const imageLoaded = await page.evaluate(() => new Promise(resolveImage => {
      const image = new Image();
      image.onload = () => resolveImage(image.naturalWidth > 0);
      image.onerror = () => resolveImage(false);
      image.src = 'galaxy-nebula.svg';
    }));
    check(imageLoaded, `galaxy asset loads at ${width}px`);
    check(await page.evaluate(() => getComputedStyle(document.body).backgroundImage.includes('galaxy-nebula.svg')), 'winning body background uses the galaxy asset');
    const starfield = await page.evaluate(async () => {
      const response = await fetch('galaxy-starfield.svg');
      const source = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      const styles = getComputedStyle(document.body);
      return { loaded: response.ok && !source.querySelector('parsererror'), stars: source.querySelectorAll('circle').length, background: styles.backgroundImage, size: styles.backgroundSize, attachment: styles.backgroundAttachment };
    });
    check(starfield.loaded && starfield.stars >= 120, 'dense standalone starfield loads without XML errors');
    check(starfield.background.includes('galaxy-starfield.svg') && starfield.size.startsWith('480px 560px'), 'small stars retain their own fixed scale instead of cover scaling');
    check(starfield.attachment === 'fixed, fixed', 'both cosmic layers stay visible while scrolling');
    for (const selector of ['.top', '.orbit']) {
      check(await page.locator(selector).evaluate(element => getComputedStyle(element).backgroundImage.includes('galaxy-starfield.svg')), `${selector} retains sharp stars over its glass tint`);
    }
    check(await page.locator('.creative-hub-compact').evaluate(element => getComputedStyle(element).backgroundImage === 'none' && getComputedStyle(element).backgroundColor === 'rgba(0, 0, 0, 0)'), 'nested opaque hub background no longer hides the galaxy');
    check(await page.locator('.top').evaluate(element => getComputedStyle(element).backgroundImage.includes('galaxy-starfield.svg') && parseFloat(getComputedStyle(element).backdropFilter.match(/blur\(([^p]+)px\)/)?.[1]) <= 16), 'chrome keeps its sharp foreground star layer while frosting overlapping content');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
    for (const selector of ['.top', '.orbit', '.tab:not(.on)']) {
      const styles = await page.locator(selector).first().evaluate(element => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color, border: style.borderTopColor };
      });
      check(!styles.background.includes('255, 255, 255'), `${selector} does not force a white panel`);
      check(styles.color !== 'rgb(16, 48, 74)', `${selector} uses light text`);
      check(styles.border !== 'rgba(0, 0, 0, 0)', `${selector} has a visible border`);
    }
    check(await page.locator('.top').evaluate(element => getComputedStyle(element).backdropFilter.includes('blur')), 'navigation uses backdrop blur');
    for (const language of ['sw', 'en', 'fr', 'zh']) {
      await page.locator('#langSelTrigger').click();await page.locator(`#langSelOptions [data-language="${language}"]`).click();
      check(await page.evaluate(selected => document.documentElement.lang === selected, language), `${language} still switches immediately`);
    }
    await page.locator('#langSelTrigger').click();await page.locator('#langSelOptions [data-language="en"]').click();
    await page.waitForTimeout(3400);
    await page.screenshot({ path: `${output}/feed-${width}.png` });
    if (await page.locator('.post').count()) {
      check(await page.locator('.post').first().evaluate(element => parseFloat(getComputedStyle(element).backgroundColor.split(',').at(-1)) <= .55), 'feed cards retain enough transparency for the starfield');
    }
    await page.evaluate(() => scrollTo(0, 1400));
    await page.waitForTimeout(350);
    check(await page.evaluate(() => scrollY > 0 && getComputedStyle(document.body).backgroundImage.includes('galaxy-starfield.svg')), 'starfield persists below the initial viewport');
    await page.screenshot({ path: `${output}/feed-scrolled-${width}.png` });
    await page.evaluate(() => scrollTo(0, 0));
    check(await page.locator('.mw-stories-live').count() === 0, 'no duplicate LIVE box beside the stories');
    await page.evaluate(() => window.MilkyWayLive.open());
    check(await page.locator('#mwLivePage').evaluate(element => getComputedStyle(element).backgroundImage.includes('galaxy-starfield.svg')), 'dedicated Live page uses the same dense starfield');
    check(await page.locator('#mwLivePage .mw-live-glass').first().evaluate(element => parseFloat(getComputedStyle(element).backdropFilter.match(/blur\(([^p]+)px\)/)?.[1]) <= 1), 'Live glass blur preserves stars on mobile and desktop');
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${output}/live-${width}.png` });
    await page.evaluate(() => window.MilkyWayLive.close());
    await page.evaluate(() => {
      const appearance = document.getElementById('mwAppearance');
      appearance.value = 'milkyway';
      appearance.dispatchEvent(new Event('change', { bubbles: true }));
    });
    check(await page.evaluate(() => document.documentElement.dataset.mwAppearance === 'milkyway' && !getComputedStyle(document.body).backgroundImage.includes('galaxy-nebula.svg')), 'clean MilkyWay appearance still works');
    await page.evaluate(() => {
      const appearance = document.getElementById('mwAppearance');
      appearance.value = 'galaxy';
      appearance.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.mwAppearance === 'galaxy');
    check(await page.evaluate(() => getComputedStyle(document.body).backgroundImage.includes('galaxy-nebula.svg')), 'galaxy selection survives reload');
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    check(await page.locator('.top').evaluate(element => getComputedStyle(element).backgroundColor === 'rgb(10, 22, 44)' && getComputedStyle(element).backdropFilter === 'none'), 'reduced-transparency fallback stays dark without blur');
    await context.close();
  }
  check(failures.length === 0, `no browser runtime errors: ${failures.join('; ')}`);
  console.log(`${checks} Galaxy appearance checks passed. Screenshots: ${output}`);
} finally {
  await browser.close();
}
