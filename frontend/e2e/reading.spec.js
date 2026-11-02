/** Exercise real reading routes with automatic browser-error capture before navigation. */
import { test, expect } from './fixtures.js';
const user = { userId: 'u', username: 'rae', displayName: 'Rae Reader', role: 'user' };
const posts = [
  { id: 'old', title: 'Older note', content: 'Old text', createdAt: '2020-01-01', authorId: 'other', authorName: 'Other Writer' },
  { id: 'new', title: 'Fresh note', content: '<script>plain text</script>\n  indented\n\nlast line',
    createdAt: '2025-02-03', authorId: 'u', authorName: 'Rae Reader' },
];
/** Seed synthetic local records once without replacing application behavior. */
async function seed(page, rows = posts) {
  await page.addInitScript(({ session, rows }) => {
    if (!localStorage.getItem('reading_fixture')) {
      localStorage.setItem('writespace_session', JSON.stringify(session));
      localStorage.setItem('writespace_posts', JSON.stringify(rows));
      localStorage.setItem('reading_fixture', 'true');
    }
  }, { session: user, rows });
}
test('seeded cards read full text and restrict other-author controls', async ({ page }) => {
  await seed(page);
  await page.goto('/blogs');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Fresh note', 'Older note']);
  await page.getByRole('link', { name: 'Fresh note', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/new$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fresh note');
  expect(await page.locator('.whitespace-pre-wrap').textContent()).toBe(posts[1].content);
  await expect(page.locator('.whitespace-pre-wrap')).toHaveCSS('white-space', 'pre-wrap');
  await expect(page.locator('main script')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/edit/new');
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await page.getByRole('link', { name: 'Older note', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
});
test('empty direct route has exact copy and real Write action', async ({ page }) => {
  await seed(page, []);
  await page.goto('/blogs');
  await expect(page.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Write', exact: true }).last()).toHaveAttribute('href', '/write');
});
test('missing direct reader provides back navigation', async ({ page }) => {
  await seed(page);
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Fresh note', 'Older note']);
});
for (const route of ['/blogs', '/blog/new']) {
  test(`guest entry ${route} redirects to login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Username')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  });
}
test('mobile menu and explicit logout update shell and guest blog entry', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page);
  await page.goto('/blogs');
  const nav = page.getByRole('navigation', { name: 'Authenticated navigation' });
  await expect(nav.getByRole('link', { name: 'All Blogs' })).toBeHidden();
  await nav.getByRole('button', { name: 'Open navigation' }).click();
  await expect(nav.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'All Blogs' }).click();
  await expect(nav.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await nav.getByRole('button', { name: /Rae Reader/ }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(user);
  await nav.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test('owner cancel preserves state; confirmed deletion persists on list', async ({ page }) => {
  await seed(page);
  await page.goto('/blogs');
  await page.getByRole('link', { name: 'Fresh note', exact: true }).click();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('Delete this post?');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blog\/new$/);
  await expect(page.getByRole('heading', { name: 'Fresh note' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(posts);
  page.once('dialog', async (dialog) => { await dialog.accept(); });
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Older note']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([posts[0]]);
  await page.getByRole('link', { name: 'Older note', exact: true }).click();
  await page.getByRole('link', { name: 'Back to All Posts' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Older note']);
});
