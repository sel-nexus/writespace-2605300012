/** Exercise real storage, route wiring and fresh Admin action boundaries. */
import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { authenticate, clearSession, setSession } from '../utils/auth.js';
import {
  createAccount,
  createAdminAccount,
  managedAccounts,
} from '../utils/accounts.js';
import { getPosts, getUsers, savePosts, saveUsers } from '../utils/storage.js';

const admin = {
  userId: 'admin',
  username: 'admin',
  displayName: 'Admin',
  role: 'admin',
};
const user = {
  userId: 'owner',
  username: 'owner',
  displayName: 'Owner',
  role: 'user',
};
const post = {
  id: 'other/post',
  title: 'Other author note',
  content: '  Plain\ntext  ',
  authorId: 'owner',
  authorName: 'Owner',
  createdAt: '2025-02-03T00:00:00Z',
};
const account = {
  id: 'owner',
  username: 'owner',
  displayName: 'Owner',
  password: 'demo-only',
  role: 'user',
  createdAt: '2025-01-01T00:00:00Z',
};

/** Mount the real application route table, including guards and shell. */
function mount(path = '/admin') {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  );
}

/** Assert all and only the three settled label/count pairs. */
function metrics(posts, users, admins) {
  const overview = within(screen.getByLabelText('Overview statistics'));
  expect(
    overview.getAllByRole('term').map((node) => node.textContent.trim()),
  ).toEqual(['Total Posts', 'Total Users', 'Total Admins']);
  expect(
    overview.getAllByRole('definition').map((node) => node.textContent.trim()),
  ).toEqual([String(posts), String(users), String(admins)]);
}

it('renders zero counts plus the built-in Admin, quick links and shell without side effects', () => {
  setSession(admin);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const confirm = vi.spyOn(window, 'confirm');
  mount();
  metrics(0, 0, 1);
  expect(screen.getByText('No posts yet.')).toBeVisible();
  expect(
    screen.getByRole('navigation', { name: 'Authenticated navigation' }),
  ).toBeVisible();
  expect(screen.getByRole('link', { name: 'Write New Post' })).toHaveAttribute(
    'href',
    '/write',
  );
  expect(screen.getByRole('link', { name: 'Manage Users' })).toHaveAttribute(
    'href',
    '/users',
  );
  expect(screen.getByText(/Unsafe local demo/)).toBeVisible();
  expect(write).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});

it.each(['{bad', '{}', 'null', '[null, {}, [], 7, "row"]'])(
  'falls back safely for malformed arrays or rows %s without writes',
  (raw) => {
    setSession(admin);
    localStorage.setItem('writespace_posts', raw);
    localStorage.setItem('writespace_users', raw);
    mount();
    metrics(0, 0, 1);
    expect(screen.getByText('No posts yet.')).toBeVisible();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
    expect(localStorage.getItem('writespace_users')).toBe(raw);
  },
);

it.each(['writespace_posts', 'writespace_users'])(
  'isolates unavailable %s reads from the other collection',
  (key) => {
    setSession(admin);
    savePosts([post]);
    saveUsers([
      account,
      { ...account, id: 'a', username: 'alex', role: 'admin' },
    ]);
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (name) {
      if (name === key) throw new Error('privacy');
      return read.call(this, name);
    });
    mount();
    metrics(
      key === 'writespace_posts' ? 0 : 1,
      key === 'writespace_users' ? 0 : 2,
      key === 'writespace_users' ? 1 : 2,
    );
  },
);

it('counts valid posts and all registered roles, excludes malformed accounts and caps newest-first recent posts at five', () => {
  setSession(admin);
  const rows = Array.from({ length: 7 }, (_, index) => ({
    ...post,
    id: `p${index}`,
    title: `Note ${index}`,
    createdAt: `2025-01-0${index + 1}`,
  }));
  savePosts([
    null,
    ...rows,
    { ...post, title: '' },
    { ...post, id: 'no-date', title: '<b>No date</b>', createdAt: null },
  ]);
  const accounts = [
    account,
    { ...account, id: 'a', username: 'alex', role: 'admin' },
    { ...account, id: 'b', username: 'bea', role: 'admin' },
    null,
    {},
    [],
    { ...account, role: 'root' },
    { ...account, username: ' ADMIN ' },
    { ...account, id: '' },
    { ...account, password: 5 },
  ];
  saveUsers(accounts);
  const before = getPosts();
  mount();
  metrics(8, 3, 3);
  const recent = within(screen.getByRole('region', { name: 'Recent Posts' }));
  expect(recent.getAllByRole('listitem')).toHaveLength(5);
  expect(
    recent
      .getAllByRole('link')
      .filter((node) => !node.getAttribute('aria-label'))
      .map((node) => node.textContent.trim()),
  ).toEqual(['Note 6', 'Note 5', 'Note 4', 'Note 3', 'Note 2']);
  expect(recent.queryByText('Note 1')).not.toBeInTheDocument();
  expect(getPosts()).toEqual(before);
  expect(getUsers()).toEqual(accounts);
});

it('counts helper-created user and Admin accounts with unchanged whitespace passwords', () => {
  setSession(admin);
  const registered = createAccount({
    displayName: 'Whitespace User',
    username: 'whitespace-user',
    password: ' ',
    confirmPassword: ' ',
  });
  const createdAdmin = createAdminAccount({
    displayName: 'Whitespace Admin',
    username: 'whitespace-admin',
    password: ' ',
    role: 'admin',
  });
  expect(registered.errors).toEqual({});
  expect(createdAdmin.errors).toEqual({});
  expect(registered.account).toMatchObject({ password: ' ', role: 'user' });
  expect(createdAdmin.account).toMatchObject({ password: ' ', role: 'admin' });
  const saved = [registered.account, createdAdmin.account];
  expect(getUsers()).toEqual(saved);
  expect(managedAccounts()).toEqual(saved);
  for (const row of saved) {
    expect(authenticate(row.username, ' ')).toEqual({
      userId: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
    });
    expect(authenticate(row.username, '')).toBeNull();
  }
  mount();
  metrics(0, 2, 2);
  expect(getUsers()).toEqual(saved);
});

it.each([null, '', ' ', 'not-a-date', 5, undefined])(
  'counts displayable accounts with unavailable dates and excludes the fixed Admin id %#',
  (createdAt) => {
    setSession(admin);
    const visible = [
      { ...account, createdAt },
      { ...account, id: 'a', username: 'alex', role: 'admin', createdAt },
    ];
    saveUsers([
      ...visible,
      { ...account, id: 'admin', username: 'legacy-admin', role: 'admin' },
    ]);
    const before = getUsers();
    expect(managedAccounts()).toEqual(before.slice(0, 2));
    mount();
    metrics(0, 2, 2);
    expect(getUsers()).toEqual(before);
  },
);

it('renders unavailable dates and escaped titles and navigates through a real recent-post link', async () => {
  setSession(admin);
  savePosts([{ ...post, title: '<b>Plain</b>', createdAt: null }]);
  const { container } = mount();
  expect(screen.getByText(/Date unavailable/)).toBeVisible();
  expect(container.querySelector('b')).toBeNull();
  await userEvent
    .setup()
    .click(screen.getByRole('link', { name: '<b>Plain</b>' }));
  expect(screen.getByRole('heading', { name: '<b>Plain</b>' })).toBeVisible();
  expect(getPosts()).toEqual([
    { ...post, title: '<b>Plain</b>', createdAt: null },
  ]);
});

it('opens the real writer through its quick action and returns via logo and Go to Dashboard', async () => {
  setSession(admin);
  mount();
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('link', { name: 'Write New Post' }));
  expect(screen.getByRole('heading', { name: 'Write a Post' })).toBeVisible();
  await actor.click(
    screen.getByRole('link', { name: 'WriteSpace', exact: true }),
  );
  await actor.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
  expect(
    screen.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toBeVisible();
  metrics(0, 0, 1);
  expect(getPosts()).toEqual([]);
});

it('edits an arbitrary other-author post through the real editor and preserves metadata', async () => {
  setSession(admin);
  savePosts([null, post, { malformed: true }]);
  mount();
  const actor = userEvent.setup();
  expect(
    screen.getByRole('link', { name: `Edit ${post.title}` }),
  ).toHaveAttribute('href', '/edit/other%2Fpost');
  await actor.click(screen.getByRole('link', { name: `Edit ${post.title}` }));
  expect(screen.getByLabelText('Title')).toHaveValue(post.title);
  await actor.clear(screen.getByLabelText('Title'));
  await actor.type(screen.getByLabelText('Title'), 'Admin revision');
  await actor.click(screen.getByRole('button', { name: 'Save', exact: true }));
  expect(screen.getByRole('heading', { name: 'Admin revision' })).toBeVisible();
  expect(getPosts()).toEqual([
    null,
    { ...post, title: 'Admin revision' },
    { malformed: true },
  ]);
});

it('cancels deletion without writing or leaving the dashboard', async () => {
  setSession(admin);
  savePosts([post]);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  mount();
  const write = vi.spyOn(Storage.prototype, 'setItem');
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: `Delete ${post.title}` }));
  expect(confirm).toHaveBeenCalledWith('Delete this post?');
  expect(write).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post]);
  expect(
    screen.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toBeVisible();
  metrics(1, 0, 1);
});

it('confirms arbitrary deletion using the fresh collection, preserves malformed rows and refreshes the recent cap', async () => {
  setSession(admin);
  savePosts([post]);
  mount();
  const additional = Array.from({ length: 6 }, (_, index) => ({
    ...post,
    id: `p${index}`,
    title: `Fresh ${index}`,
  }));
  savePosts([null, post, ...additional, { malformed: true }]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: `Delete ${post.title}` }));
  expect(getPosts()).toEqual([null, ...additional, { malformed: true }]);
  metrics(6, 0, 1);
  expect(
    within(screen.getByRole('region', { name: 'Recent Posts' })).getAllByRole(
      'listitem',
    ),
  ).toHaveLength(5);
  expect(
    screen.queryByRole('link', { name: post.title }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Admin Dashboard' }),
  ).toBeVisible();
});

it.each(['quota', 'permission'])(
  'keeps the dashboard and stored post on %s write failure and allows a fresh retry',
  async (reason) => {
    setSession(admin);
    savePosts([post]);
    mount();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const denied = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error(reason);
      });
    const actor = userEvent.setup();
    await actor.click(
      screen.getByRole('button', { name: `Delete ${post.title}` }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Post could not be deleted in this browser.',
    );
    expect(getPosts()).toEqual([post]);
    metrics(1, 0, 1);
    expect(
      screen.getByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeVisible();
    denied.mockRestore();
    await actor.click(
      screen.getByRole('button', { name: `Delete ${post.title}` }),
    );
    expect(getPosts()).toEqual([]);
    metrics(0, 0, 1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

it.each(['delete', 'edit'])(
  'rejects stale missing and ambiguous records for %s without write or navigation',
  async (action) => {
    setSession(admin);
    savePosts([post]);
    mount();
    savePosts([null, { malformed: true }]);
    const before = getPosts();
    const confirm = vi.spyOn(window, 'confirm');
    const actor = userEvent.setup();
    const target = () =>
      screen.getByRole(action === 'delete' ? 'button' : 'link', {
        name: `${action === 'delete' ? 'Delete' : 'Edit'} ${post.title}`,
      });
    await actor.click(target());
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found.');
    expect(getPosts()).toEqual(before);
    savePosts([post, { ...post }]);
    await actor.click(target());
    expect(getPosts()).toEqual([post, post]);
    expect(screen.getByRole('alert')).toHaveTextContent('Post not found.');
    expect(confirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeVisible();
  },
);

it.each(['delete', 'edit'])(
  'rejects a session downgraded to the owner before %s activation',
  async (action) => {
    setSession(admin);
    savePosts([post]);
    mount();
    setSession(user);
    const confirm = vi.spyOn(window, 'confirm');
    await userEvent.setup().click(
      screen.getByRole(action === 'delete' ? 'button' : 'link', {
        name: `${action === 'delete' ? 'Delete' : 'Edit'} ${post.title}`,
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Admin access is required to manage posts.',
    );
    expect(getPosts()).toEqual([post]);
    expect(confirm).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: `Delete ${post.title}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: `Edit ${post.title}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeVisible();
  },
);

it('rejects a removed session before confirmation without writing', async () => {
  setSession(admin);
  savePosts([post]);
  mount();
  clearSession();
  const confirm = vi.spyOn(window, 'confirm');
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: `Delete ${post.title}` }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Admin access is required to manage posts.',
  );
  expect(confirm).not.toHaveBeenCalled();
  expect(getPosts()).toEqual([post]);
});

it.each(['guest', 'owner', 'missing', 'duplicate'])(
  'rechecks %s changes during confirmation and stays on the dashboard',
  async (change) => {
    setSession(admin);
    savePosts([post]);
    mount();
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      if (change === 'guest') clearSession();
      if (change === 'owner') setSession(user);
      if (change === 'missing') savePosts([]);
      if (change === 'duplicate') savePosts([post, post]);
      return true;
    });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: `Delete ${post.title}` }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      ['missing', 'duplicate'].includes(change)
        ? 'Post not found.'
        : 'Admin access is required to manage posts.',
    );
    expect(getPosts()).toEqual(
      change === 'missing'
        ? []
        : change === 'duplicate'
          ? [post, post]
          : [post],
    );
    expect(
      screen.getByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeVisible();
  },
);

it.each([null, '{bad', JSON.stringify(user)])(
  'excludes guest, malformed and user sessions through the real App guard %#',
  (raw) => {
    savePosts([post]);
    if (raw !== null) localStorage.setItem('writespace_session', raw);
    mount();
    expect(
      screen.getByRole('heading', {
        name: raw === JSON.stringify(user) ? 'All Blogs' : 'Login',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Admin Dashboard' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Manage Users' }),
    ).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  },
);
