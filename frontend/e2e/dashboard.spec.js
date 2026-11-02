/** Exercise real Admin login, overview, publishing and other-author management. */
import { test, expect } from './fixtures.js';

test('UI Admin login → overview → write/read → overview → arbitrary edit and cancel/confirm delete persists', async ({
  page,
}) => {
  const posts = Array.from({ length: 7 }, (_, index) => ({
    id: `owner-${index}`,
    title: `Owner note ${index}`,
    content: `Owner content ${index}`,
    authorId: 'owner',
    authorName: 'Owner',
    createdAt: `2025-01-0${index + 1}T00:00:00.000Z`,
  }));
  const accounts = [
    {
      id: 'owner',
      username: 'owner',
      displayName: 'Owner',
      password: 'demo-only',
      role: 'user',
      createdAt: '2025-01-01',
    },
    {
      id: 'alex',
      username: 'alex',
      displayName: 'Alex',
      password: 'demo-only',
      role: 'admin',
      createdAt: '2025-01-01',
    },
  ];
  await page.addInitScript(
    ({ posts, accounts }) => {
      if (!localStorage.getItem('writespace_posts'))
        localStorage.setItem(
          'writespace_posts',
          JSON.stringify([null, ...posts, { malformed: true }]),
        );
      if (!localStorage.getItem('writespace_users'))
        localStorage.setItem('writespace_users', JSON.stringify(accounts));
    },
    { posts, accounts },
  );
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toBeVisible();
  const stats = page.getByLabel('Overview statistics');
  await expect(stats.locator('dt')).toHaveText([
    'Total Posts',
    'Total Users',
    'Total Admins',
  ]);
  await expect(stats.locator('dd')).toHaveText(['7', '2', '2']);
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('listitem')).toHaveCount(5);
  await expect(recent.locator('li > div:first-child > a')).toHaveText([
    'Owner note 6',
    'Owner note 5',
    'Owner note 4',
    'Owner note 3',
    'Owner note 2',
  ]);
  await expect(
    page.getByRole('link', { name: 'Manage Users' }),
  ).toHaveAttribute('href', '/users');
  const identity = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('writespace_session')),
  );
  expect(identity).toEqual({
    userId: 'admin',
    username: 'admin',
    displayName: 'Admin',
    role: 'admin',
  });
  await page.getByRole('link', { name: 'Write New Post' }).click();
  await page.getByLabel('Title').fill('Admin new note');
  await page.getByLabel('Content').fill('  Admin plain text\n  ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Admin new note' }),
  ).toBeVisible();
  const created = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('writespace_posts')).at(-1),
  );
  expect(created).toEqual({
    id: expect.any(String),
    title: 'Admin new note',
    content: '  Admin plain text\n  ',
    authorId: 'admin',
    authorName: 'Admin',
    createdAt: expect.any(String),
  });
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(stats.locator('dd')).toHaveText(['8', '2', '2']);
  await page
    .getByRole('link', { name: 'Edit Owner note 6', exact: true })
    .click();
  await expect(page.getByLabel('Content')).toHaveValue(posts[6].content);
  await page.getByLabel('Title').fill('Admin revised owner note');
  await page.getByLabel('Content').fill('Revised by Admin');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Admin revised owner note' }),
  ).toBeVisible();
  const updated = {
    ...posts[6],
    title: 'Admin revised owner note',
    content: 'Revised by Admin',
  };
  const afterEdit = [
    null,
    ...posts.slice(0, 6),
    updated,
    { malformed: true },
    created,
  ];
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual(afterEdit);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('button', {
      name: 'Delete Admin revised owner note',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual(afterEdit);
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', {
      name: 'Delete Admin revised owner note',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  const remaining = [null, ...posts.slice(0, 6), { malformed: true }, created];
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual(remaining);
  await expect(stats.locator('dd')).toHaveText(['7', '2', '2']);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Admin revised owner note', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      posts: JSON.parse(localStorage.getItem('writespace_posts')),
      users: JSON.parse(localStorage.getItem('writespace_users')),
      session: JSON.parse(localStorage.getItem('writespace_session')),
    })),
  ).toEqual({ posts: remaining, users: accounts, session: identity });
});

test('guest initial dashboard entry goes to Login without Admin controls', async ({
  page,
}) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Login', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_session')),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_posts')),
  ).toBeNull();
});

test('user initial dashboard entry goes to All Blogs without Admin controls or writes', async ({
  page,
}) => {
  const session = {
    userId: 'reader',
    username: 'reader',
    displayName: 'Reader',
    role: 'user',
  };
  await page.addInitScript((identity) => {
    localStorage.setItem('writespace_session', JSON.stringify(identity));
  }, session);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole('heading', { name: 'All Blogs', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage Users' })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_session')),
    ),
  ).toEqual(session);
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_posts')),
  ).toBeNull();
});
