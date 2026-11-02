/** Verify real writing journeys and local records with automatic browser-error capture. */
import { test, expect } from './fixtures.js';

test('UI register → write → read → edit → reload → delete cancel/confirm preserves the data contract', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Get Started Free', exact: true })
    .click();
  await page.getByLabel('Display name').fill('Rae Writer');
  await page.getByLabel('Username').fill('rae');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password').fill('demo-only');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const identity = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('writespace_session')),
  );
  await page
    .getByRole('navigation', { name: 'Authenticated navigation' })
    .getByRole('link', { name: 'Write', exact: true })
    .click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(
    page.getByRole('heading', { name: 'Write a Post', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(2);
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_posts')),
  ).toBeNull();
  await page.getByLabel('Title').fill('Discarded');
  await page.getByLabel('Content').fill('Unsaved draft');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(
    await page.evaluate(() => localStorage.getItem('writespace_posts')),
  ).toBeNull();
  await expect(
    page.getByRole('main').getByText('No blogs yet. Be the first to write one!'),
  ).toBeVisible();
  await page
    .getByRole('main')
    .getByRole('link', { name: 'Write', exact: true })
    .click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(
    page.getByRole('heading', { name: 'Write a Post', exact: true }),
  ).toBeVisible();
  const content = '  A plain-text <b>thought</b>\n\tSecond line  ';
  await page.getByLabel('Title').fill('  First Note  ');
  await page.getByLabel('Content').fill(content);
  await expect(
    page.getByText(`${content.length} characters`, { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/[0-9a-f-]+$/);
  await expect(
    page.getByRole('heading', { name: 'First Note', exact: true }),
  ).toBeVisible();
  expect(
    await page.locator('article p.whitespace-pre-wrap').textContent(),
  ).toBe(content);
  await expect(page.locator('article b')).toHaveCount(0);
  const created = await page.evaluate(
    () => JSON.parse(localStorage.getItem('writespace_posts'))[0],
  );
  expect(created).toEqual({
    id: expect.any(String),
    title: 'First Note',
    content,
    createdAt: expect.any(String),
    authorId: identity.userId,
    authorName: identity.displayName,
  });
  expect(created.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('First Note');
  await expect(page.getByLabel('Content')).toHaveValue(content);
  await page.getByLabel('Content').fill('Discarded edit');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([created]);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  const revisedContent = '  Revised\n\t' + 'x'.repeat(10000) + '\n  ';
  await page.getByLabel('Title').fill('  Revised Note  ');
  await page.getByLabel('Content').fill(revisedContent);
  await expect(
    page.getByText(`${revisedContent.length} characters`, { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Revised Note', exact: true }),
  ).toBeVisible();
  const updated = {
    ...created,
    title: 'Revised Note',
    content: revisedContent,
  };
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([updated]);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Revised Note', exact: true }),
  ).toBeVisible();
  expect(
    await page.locator('article p.whitespace-pre-wrap').textContent(),
  ).toBe(revisedContent);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([updated]);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${created.id}$`));
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([updated]);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_session')),
    ),
  ).toEqual(identity);
  const users = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('writespace_users')),
  );
  expect(users).toHaveLength(1);
  expect(users[0].id).toBe(identity.userId);
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'First Note', exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([]);
});

// Admin dashboard is a future slice. Start on blogs with explicit synthetic identities
// only for ownership fixtures; the main user journey above authenticates through the UI.
test('non-owner has no management controls and can only create their own post', async ({
  page,
}) => {
  const existing = {
    id: 'owner-post',
    title: 'Owner Note',
    content: 'Owner content',
    createdAt: '2025-01-01T00:00:00.000Z',
    authorId: 'owner',
    authorName: 'Owner',
  };
  await page.addInitScript((post) => {
    localStorage.setItem(
      'writespace_session',
      JSON.stringify({
        userId: 'other',
        username: 'other',
        displayName: 'Other Writer',
        role: 'user',
      }),
    );
    localStorage.setItem(
      'writespace_posts',
      JSON.stringify([null, post, { malformed: true }]),
    );
  }, existing);
  await page.goto('/blogs');
  await expect(
    page.getByRole('link', { name: 'Edit Owner Note', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Owner Note', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Edit', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Delete', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Other Note');
  await page.getByLabel('Content').fill('Other content');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Other Note', exact: true }),
  ).toBeVisible();
  const rows = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('writespace_posts')),
  );
  expect(rows.slice(0, 3)).toEqual([null, existing, { malformed: true }]);
  expect(rows[3].authorId).toBe('other');
  await expect(
    page.getByRole('link', { name: 'Edit', exact: true }),
  ).toBeVisible();
});

test('Admin edits any post preserving owner metadata and cancels/confirms deletion without losing malformed rows', async ({
  page,
}) => {
  const existing = {
    id: 'owner-post',
    title: 'Owner Note',
    content: '  Owner\ncontent  ',
    createdAt: '2025-01-01T00:00:00.000Z',
    authorId: 'owner',
    authorName: 'Owner',
  };
  await page.addInitScript((post) => {
    localStorage.setItem(
      'writespace_session',
      JSON.stringify({
        userId: 'admin',
        username: 'admin',
        displayName: 'Admin',
        role: 'admin',
      }),
    );
    localStorage.setItem(
      'writespace_posts',
      JSON.stringify([null, post, { malformed: true }]),
    );
  }, existing);
  await page.goto('/blogs');
  await page
    .getByRole('link', { name: 'Edit Owner Note', exact: true })
    .click();
  await expect(page.getByLabel('Content')).toHaveValue(existing.content);
  await page.getByLabel('Title').fill('Admin Revised');
  await page.getByLabel('Content').fill('  Admin revision\n  ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Admin Revised', exact: true }),
  ).toBeVisible();
  const updated = {
    ...existing,
    title: 'Admin Revised',
    content: '  Admin revision\n  ',
  };
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([null, updated, { malformed: true }]);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([null, updated, { malformed: true }]);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('writespace_posts')),
    ),
  ).toEqual([null, { malformed: true }]);
});
