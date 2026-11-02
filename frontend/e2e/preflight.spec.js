/** Capture review evidence from actual desktop and mobile product states. */
import { writeFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';

/** Save semantic structure, computed styles and a screenshot for human review. */
async function capture(page, name, info) {
  const semantics = await page.locator('body').ariaSnapshot();
  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const heading = document.querySelector('h1');
    return {
      bodyFont: body.fontFamily,
      headingFont: heading ? getComputedStyle(heading).fontFamily : null,
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      headings: [...document.querySelectorAll('h1,h2,h3')].map((el) => el.textContent),
    };
  });
  await writeFile(info.outputPath(`${name}.txt`), semantics + '\n' + JSON.stringify(styles, null, 2));
  await writeFile(info.outputPath(`${name}.html`), await page.content());
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  expect(styles.documentWidth).toBeLessThanOrEqual(styles.viewport);
}

test('desktop discovery, empty overview and form error evidence', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'WriteSpace', exact: true })).toBeVisible();
  await capture(page, 'desktop-landing', info);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await capture(page, 'desktop-dashboard', info);
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Title is required.', { exact: true })).toBeVisible();
  await capture(page, 'desktop-editor-error', info);
});

test('mobile registration, populated reading and navigation evidence', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await page.getByLabel('Display name', { exact: true }).fill('Mira Local');
  await page.getByLabel('Username', { exact: true }).fill('mira-demo');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await capture(page, 'mobile-empty', info);
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('A local thought');
  await page.getByLabel('Content', { exact: true }).fill('First line\n\nSecond line');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A local thought', exact: true })).toBeVisible();
  await capture(page, 'mobile-reader', info);
});
