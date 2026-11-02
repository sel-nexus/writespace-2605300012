/** Cover guest UI journeys and persisted local data without running future slices. */
import { test, expect } from './fixtures.js';
test('guest empty discovery, invalid login and fixed Admin sign-in', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'WriteSpace' }),
  ).toBeVisible();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(
    page.getByText(/passwords are stored in plaintext/),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username').fill('nobody');
  await page.getByLabel('Password').fill('demo-only');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Invalid username or password.',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_session')),
  ).toBeNull();
  await page.getByLabel('Username').fill(' ADMIN ');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toBeVisible();
  await expect(page.getByText('Admin', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_session')),
    ),
  ).toEqual({
    userId: 'admin',
    username: 'admin',
    displayName: 'Admin',
    role: 'admin',
  });
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.reload();
  await expect(page.getByRole('img', { name: 'Admin avatar' })).toBeVisible();
});
test('local previews are ordered and capped; guest selection enters login', async ({
  page,
}) => {
  const posts = [
    {
      id: 'old',
      title: 'Old local note',
      content: 'old',
      createdAt: '2020-01-01T00:00:00Z',
      authorId: 'fixture',
      authorName: 'Demo',
    },
    {
      id: 'new',
      title: 'New local note',
      content: 'n'.repeat(121),
      createdAt: '2025-02-03T00:00:00Z',
      authorId: 'fixture',
      authorName: 'Demo',
    },
    {
      id: 'second',
      title: 'Second local note',
      content: '<script>plain text</script>',
      createdAt: '2024-01-01T00:00:00Z',
      authorId: 'fixture',
      authorName: 'Demo',
    },
    {
      id: 'third',
      title: 'Third local note',
      content: 'third',
      createdAt: '2023-01-01T00:00:00Z',
      authorId: 'fixture',
      authorName: 'Demo',
    },
  ];
  await page.addInitScript((rows) => {
    if (!localStorage.getItem('writespace_posts'))
      localStorage.setItem('writespace_posts', JSON.stringify(rows));
  }, posts);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 3 })).toHaveText([
    'New local note',
    'Second local note',
    'Third local note',
  ]);
  await expect(page.getByText('Feb 03, 2025')).toBeVisible();
  await expect(page.getByText('n'.repeat(120), { exact: true })).toBeVisible();
  await expect(
    page.getByText('<script>plain text</script>', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual(posts);
  await page.getByRole('link', { name: 'New local note' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_session')),
  ).toBeNull();
  await page.getByRole('link', { name: 'WriteSpace' }).click();
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3);
});
test('mobile public actions enter completed registration and login routes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Display name')).toBeVisible();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'WriteSpace' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Get Started Free', exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Display name')).toBeVisible();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'WriteSpace' }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Public navigation' })
    .getByRole('link', { name: 'Login', exact: true })
    .click();
  await expect(page.getByLabel('Username')).toBeVisible();
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Register' }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('guest-mobile.png'),
    fullPage: true,
  });
});
