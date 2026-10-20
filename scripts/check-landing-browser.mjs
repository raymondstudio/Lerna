import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { localTargets } from '../tests/support/local-targets.mjs';

const targets = localTargets();
const preflight = await fetch(`${targets.app}/api/internal/test-readiness`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
if (!preflight?.ok || (await preflight.json()).provider !== 'mock') throw new Error('BLOCKED: run the local development app with mocked providers before browser checks.');
const evidence = '.stabilization-local/evidence';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const allowLocal = route => {
  const url = new URL(route.request().url());
  return url.origin === targets.app || ['data:', 'about:'].includes(url.protocol)
    ? route.continue() : route.abort('blockedbyclient');
};
try {
  for (const width of [360, 390, 768, 1280, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' });
    await context.route('**/*', allowLocal);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /hydration|unhandled|uncaught/i.test(message.text())) errors.push(message.text());
    });
    await page.goto(targets.app, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const hero = (await page.getByRole('heading', { level: 1 }).innerText()).replace(/\s+/g, ' ').trim();
    if (hero !== 'Understand your materials. Keep what you learn.') throw new Error(`Hero mismatch at ${width}px.`);
    const cta = page.getByRole('link', { name: /^Get started/ }).first();
    if (!await cta.isVisible()) throw new Error(`Primary entry point missing at ${width}px.`);
    const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth, animations: document.getAnimations().length }));
    if (layout.scrollWidth > width) throw new Error(`Horizontal overflow at ${width}px: ${layout.scrollWidth}.`);
    // The HTML/CTA is available first. Wait for React to attach before toggling
    // native <details>, which otherwise changes the server markup mid-hydration.
    await page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some(key => key.startsWith('__reactFiber$')));
    if (width < 900) {
      await page.locator('summary[aria-label="Navigation menu"]').click();
      if (!await page.getByRole('navigation', { name: 'Mobile navigation' }).isVisible()) throw new Error(`Mobile navigation failed at ${width}px.`);
      await page.locator('summary[aria-label="Navigation menu"]').click();
    }
    await page.getByText('How do saved notes work?', { exact: true }).click();
    if (!await page.locator('details[open]').filter({ hasText: 'Saved status' }).count()) throw new Error(`FAQ disclosure failed at ${width}px.`);
    const preview = page.getByRole('img', { name: /^Lerna chat workspace/ });
    await preview.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => { const image = document.querySelector('img[alt^="Lerna chat workspace"]'); return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0; });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${evidence}/landing-integrated-${width}.png`, fullPage: true });
    await cta.click();
    try { await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 }); }
    catch { throw new Error(`Signup entry failed at ${width}px (${page.url()}).`); }
    if (errors.length) throw new Error(`Page errors at ${width}px: ${errors.join('; ').slice(0, 10000)}`);
    if (width === 390) await page.screenshot({ path: `${evidence}/landing-integrated-auth-390.png` });
    results.push({ width, ...layout, hero: true, faq: true, authEntry: true, pageErrors: 0 });
    await context.close();
  }
  const light = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce', colorScheme: 'light' });
  await light.addInitScript(() => window.localStorage.setItem('theme', 'light'));
  await light.route('**/*', allowLocal);
  const lightPage = await light.newPage();
  await lightPage.goto(targets.app, { waitUntil: 'domcontentloaded' });
  await lightPage.waitForFunction(() => document.documentElement.classList.contains('light'));
  await lightPage.getByRole('img', { name: /^Lerna chat workspace/ }).scrollIntoViewIfNeeded();
  await lightPage.waitForFunction(() => { const image = document.querySelector('img[alt^="Lerna chat workspace"]'); return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0; });
  await lightPage.evaluate(() => window.scrollTo(0, 0));
  await lightPage.screenshot({ path: `${evidence}/landing-integrated-390-light.png`, fullPage: true });
  await lightPage.keyboard.press('Tab');
  const focus = await lightPage.evaluate(() => document.activeElement?.textContent?.trim());
  if (focus !== 'Skip to content') throw new Error(`Keyboard skip link is not first; focused ${focus ?? 'nothing'}.`);
  await light.close();

  const standard = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await standard.route('**/*', allowLocal);
  const standardPage = await standard.newPage();
  await standardPage.goto(targets.app, { waitUntil: 'domcontentloaded' });
  if (!await standardPage.getByRole('link', { name: /^Get started/ }).first().isVisible()) throw new Error('The primary CTA waited for motion.');
  await standardPage.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some(key => key.startsWith('__reactFiber$')));
  await standardPage.waitForTimeout(1200);
  const running = await standardPage.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length);
  if (running > 0) throw new Error(`Decorative landing motion did not settle (${running} running).`);
  await standard.close();

  const slow = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  await slow.route('**/*', allowLocal);
  const slowPage = await slow.newPage();
  const cdp = await slow.newCDPSession(slowPage);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 250, downloadThroughput: 100 * 1024, uploadThroughput: 50 * 1024 });
  await slowPage.goto(targets.app, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (!await slowPage.getByRole('link', { name: /^Get started/ }).first().isVisible()) throw new Error('Primary CTA is unavailable on a slow connection.');
  await slow.close();
} finally { await browser.close(); }
await writeFile(`${evidence}/landing-integrated.json`, JSON.stringify({ app: targets.app, mode: 'local development; provider mocked; auth unavailable', results, lightTheme: true, keyboardSkipLink: true, finiteMotion: true, slowConnectionCta: true }, null, 2));
console.info(JSON.stringify({ widths: results.map(result => result.width), overflow: false, hero: true, faq: true, authEntry: true, keyboardSkipLink: true, finiteMotion: true, slowConnectionCta: true, pageErrors: 0 }));
