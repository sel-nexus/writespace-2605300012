/** Exercise actual UI registration and persistence with automatic browser-error checks. */
import { test, expect } from './fixtures.js';

test('invalid login, UI registration, canonical storage, reload and authenticated entry redirects', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username').fill('Rae');
  await page.getByLabel('Password').fill('wrong-demo-only');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Invalid username or password.',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_session')),
  ).toBeNull();

  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  await page.getByLabel('Display name').fill('  Rae Reader  ');
  await page.getByLabel('Username').fill('  Rae  ');
  await page.getByLabel('Password', { exact: true }).fill(' demo-only ');
  await page.getByLabel('Confirm password').fill('demo-only');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_users')),
  ).toBeNull();
  await page.getByLabel('Confirm password').fill(' demo-only ');
  await page.getByRole('button', { name: 'Register', exact: true }).click();

  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByText('Rae Reader', { exact: true })).toBeVisible();
  const state = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(state.users).toHaveLength(1);
  const account = state.users[0];
  expect(account).toEqual({
    id: expect.any(String),
    displayName: 'Rae Reader',
    username: 'Rae',
    password: ' demo-only ',
    role: 'user',
    createdAt: expect.any(String),
  });
  expect(account.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  expect(state.session).toEqual({
    userId: account.id,
    username: 'Rae',
    displayName: 'Rae Reader',
    role: 'user',
  });
  await page.reload();
  await expect(page.getByText('Rae Reader', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => ({
      users: JSON.parse(localStorage.getItem('writespace_users')),
      session: JSON.parse(localStorage.getItem('writespace_session')),
    })),
  ).toEqual(state);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page
    .getByRole('link', { name: 'Get Started Free', exact: true })
    .click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: 'Register' })).toHaveCount(0);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  // Footer Login remains an actual incoming link even for a local session.
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole('heading', { name: 'Login', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_session')),
    ),
  ).toEqual(state.session);
  await page.getByRole('button', { name: /Rae Reader/ }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByLabel('Username').fill(' rAE ');
  await page.getByLabel('Password').fill(' demo-only ');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(state.session);
});

test('mobile header registration entry rejects reserved names and returns through Login', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel('Display name').fill('Demo Reader');
  await page.getByLabel('Username').fill('  ADMIN  ');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password').fill('demo-only');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'This username is reserved.',
  );
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_users')),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_session')),
  ).toBeNull();
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await expect(page.getByLabel('Display name')).toHaveValue('');
  await page.screenshot({
    path: test.info().outputPath('registration-mobile.png'),
    fullPage: true,
  });
});
