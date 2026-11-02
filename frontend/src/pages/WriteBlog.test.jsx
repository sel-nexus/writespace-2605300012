/** Exercise the controlled editor and actual storage, guards and fresh mutation checks. */
import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WriteBlog from './WriteBlog.jsx';
import ReadBlog from './ReadBlog.jsx';
import App from '../App.jsx';
import { clearSession, getSession, setSession } from '../utils/auth.js';
import { getPosts, savePosts, saveUsers } from '../utils/storage.js';

const session = {
  userId: 'u',
  username: 'rae',
  displayName: 'Rae Reader',
  role: 'user',
};
const post = {
  id: 'p',
  title: 'Original',
  content: '  Original\n\tcontent  ',
  createdAt: '2025-01-02T00:00:00.000Z',
  authorId: 'u',
  authorName: 'Original Author',
};

/** Mount observable reader and navigation destinations under StrictMode. */
function mount(path = '/write') {
  return render(
    <StrictMode>
      <MemoryRouter
        initialEntries={[path]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/write" element={<WriteBlog />} />
          <Route path="/edit/:id" element={<WriteBlog editing />} />
          <Route path="/blog/:id" element={<ReadBlog />} />
          <Route path="/blogs" element={<p>All posts destination</p>} />
          <Route path="/login" element={<p>Login destination</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Change native controlled fields, including pasted large plain-text values. */
function fill(title = '  Heading  ', content = '  Text\n\tcontent  ') {
  fireEvent.change(screen.getByLabelText('Title'), {
    target: { value: title },
  });
  fireEvent.change(screen.getByLabelText('Content'), {
    target: { value: content },
  });
}

/** Activate the explicit save control through the user-facing form. */
async function save() {
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Save', exact: true }));
}

describe('WriteBlog', () => {
  it('does not duplicate a create through rapid repeated Save activation', async () => {
    setSession(session);
    mount();
    fill();
    await userEvent
      .setup()
      .dblClick(screen.getByRole('button', { name: 'Save', exact: true }));
    expect(getPosts()).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeVisible();
  });
  it('redirects non-owners through the actual App edit route without mutation', async () => {
    setSession({ ...session, userId: 'other' });
    savePosts([post]);
    render(
      <MemoryRouter
        initialEntries={['/edit/p']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('link', { name: 'Original', exact: true }),
    ).toBeVisible();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  });
  it('renders required accessible fields and a controlled counter with no render/input writes', async () => {
    setSession(session);
    mount();
    for (const label of ['Title', 'Content']) {
      expect(screen.getByLabelText(label)).toBeRequired();
      expect(screen.getByLabelText(label)).toHaveAttribute(
        'aria-required',
        'true',
      );
      expect(screen.getByLabelText(label)).toHaveAttribute(
        'aria-invalid',
        'false',
      );
    }
    expect(screen.getByLabelText('Content')).toHaveClass('min-h-64');
    expect(screen.getByLabelText('Content')).not.toHaveAttribute('maxlength');
    expect(screen.getByText('0 characters')).toBeVisible();
    await userEvent.setup().type(screen.getByLabelText('Content'), 'Hi\nthere');
    expect(screen.getByText('8 characters')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Content'), {
      target: { value: '😀  ' },
    });
    expect(screen.getByText('4 characters')).toBeVisible();
    expect(screen.getByText(/Do not use real passwords/)).toBeVisible();
    expect(localStorage.getItem('writespace_posts')).toBeNull();
    expect(getSession()).toEqual(session);
  });
  it.each([
    ['', '', ['Title is required.', 'Content is required.']],
    [' \t ', 'Text', ['Title is required.']],
    ['Title', ' \n\t ', ['Content is required.']],
  ])(
    'rejects empty or whitespace-only fields %# with associated errors and no writes',
    async (title, content, messages) => {
      setSession(session);
      savePosts([post]);
      mount();
      fill(title, content);
      await save();
      expect(screen.getAllByRole('alert')).toHaveLength(messages.length);
      for (const message of messages) {
        const field = message.startsWith('Title') ? 'title' : 'content';
        expect(screen.getByText(message)).toHaveAttribute(
          'id',
          `${field}-error`,
        );
        expect(
          screen.getByLabelText(field === 'title' ? 'Title' : 'Content'),
        ).toHaveAttribute('aria-invalid', 'true');
        expect(
          screen
            .getByLabelText(field === 'title' ? 'Title' : 'Content')
            .getAttribute('aria-describedby'),
        ).toContain(`${field}-error`);
      }
      expect(getPosts()).toEqual([post]);
      expect(
        screen.getByRole('heading', { name: 'Write a Post' }),
      ).toBeVisible();
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    },
  );
  it('clears errors after correction and creates exact schema, long content and session author before real reading', async () => {
    setSession(session);
    const rows = [null, post, { malformed: true }];
    savePosts(rows);
    mount();
    await save();
    const content = '  <b>plain text</b>\n\t' + 'x'.repeat(100000) + '\n  ';
    fill('  New Title  ', content);
    expect(screen.getByText(`${content.length} characters`)).toBeVisible();
    await save();
    const created = getPosts()[3];
    expect(created).toEqual({
      id: expect.any(String),
      createdAt: expect.any(String),
      title: 'New Title',
      content,
      authorId: 'u',
      authorName: 'Rae Reader',
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    expect(getPosts()).toEqual([...rows, created]);
    expect(screen.getByRole('heading', { name: 'New Title' })).toBeVisible();
    expect(
      screen.getByText(
        (text, element) =>
          element.tagName === 'P' && element.textContent === content,
      ).textContent,
    ).toBe(content);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each(['user', 'admin'])(
    'prefills and edits as %s without changing original identity, author or date',
    async (role) => {
      setSession({
        ...session,
        role,
        userId: role === 'admin' ? 'admin' : 'u',
        displayName: 'Changed Name',
      });
      const rows = [null, post, { ...post, id: 'other' }, { id: 'malformed' }];
      savePosts(rows);
      mount('/edit/p');
      expect(screen.getByLabelText('Title')).toHaveValue(post.title);
      expect(screen.getByLabelText('Content')).toHaveValue(post.content);
      expect(
        screen.getByText(`${post.content.length} characters`),
      ).toBeVisible();
      expect(getPosts()).toEqual(rows);
      fill('  Revised  ', '  Revised\n\tcontent  ');
      await save();
      const updated = {
        ...post,
        title: 'Revised',
        content: '  Revised\n\tcontent  ',
      };
      expect(getPosts()).toEqual([null, updated, ...rows.slice(2)]);
      expect(screen.getByRole('heading', { name: 'Revised' })).toBeVisible();
      expect(screen.getByText('Original Author')).toBeVisible();
    },
  );
  it.each(['/write', '/edit/p'])(
    'cancel from %s discards local input without any storage changes',
    async (path) => {
      setSession(session);
      savePosts([post]);
      saveUsers([{ id: 'account' }]);
      const before = {
        posts: localStorage.getItem('writespace_posts'),
        users: localStorage.getItem('writespace_users'),
        session: localStorage.getItem('writespace_session'),
      };
      mount(path);
      fill('Discard me', 'Discard content');
      await userEvent
        .setup()
        .click(screen.getByRole('link', { name: 'Cancel' }));
      expect(
        path === '/write'
          ? screen.getByText('All posts destination')
          : screen.getByRole('heading', { name: 'Original' }),
      ).toBeVisible();
      expect({
        posts: localStorage.getItem('writespace_posts'),
        users: localStorage.getItem('writespace_users'),
        session: localStorage.getItem('writespace_session'),
      }).toEqual(before);
    },
  );
  it.each(
    [[], [post, post], [post, { id: 'p' }], [{ ...post, content: null }]].map(
      (rows) => [rows],
    ),
  )(
    'shows not-found for missing/corrupt/ambiguous edit %# without controls or writes',
    (rows) => {
      setSession(session);
      savePosts(rows);
      mount('/edit/p');
      expect(
        screen.getByRole('heading', { name: 'Post not found' }),
      ).toBeVisible();
      expect(
        screen.getByRole('link', { name: 'Back to All Posts' }),
      ).toHaveAttribute('href', '/blogs');
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Save' }),
      ).not.toBeInTheDocument();
      expect(getPosts()).toEqual(rows);
    },
  );
  it('redirects a non-owner without exposing editor controls', async () => {
    setSession({ ...session, userId: 'other' });
    savePosts([post]);
    mount('/edit/p');
    expect(await screen.findByText('All posts destination')).toBeVisible();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  });
  it.each(['/write', '/edit/p'])(
    'redirects missing session from %s without mutation',
    async (path) => {
      savePosts([post]);
      mount(path);
      expect(await screen.findByText('Login destination')).toBeVisible();
      expect(getPosts()).toEqual([post]);
    },
  );
  it.each(['/write', '/edit/p'])(
    'rechecks a session removed after rendering %s before any save',
    async (path) => {
      setSession(session);
      savePosts([post]);
      mount(path);
      fill();
      clearSession();
      await save();
      expect(await screen.findByText('Login destination')).toBeVisible();
      expect(getPosts()).toEqual([post]);
    },
  );
  it('uses changed current identity for new posts rather than mount identity', async () => {
    setSession(session);
    mount();
    fill();
    setSession({ ...session, userId: 'new', displayName: 'New Writer' });
    await save();
    expect(getPosts()[0].authorId).toBe('new');
    expect(getPosts()[0].authorName).toBe('New Writer');
  });
  it.each(['session', 'owner'])(
    'rejects edit when current %s changes after prefill',
    async (changed) => {
      setSession(session);
      savePosts([post]);
      mount('/edit/p');
      fill();
      if (changed === 'session') setSession({ ...session, userId: 'other' });
      else savePosts([{ ...post, authorId: 'other' }]);
      await save();
      expect(await screen.findByText('All posts destination')).toBeVisible();
      expect(getPosts()).toEqual([
        changed === 'session' ? post : { ...post, authorId: 'other' },
      ]);
    },
  );
  it.each(
    [[], [post, { id: 'p' }], [{ ...post, title: null }]].map((rows) => [rows]),
  )(
    'rechecks missing or ambiguous fresh target %# before saving',
    async (rows) => {
      setSession(session);
      savePosts([post]);
      mount('/edit/p');
      fill();
      savePosts(rows);
      await save();
      expect(
        screen.getByRole('heading', { name: 'Post not found' }),
      ).toBeVisible();
      expect(getPosts()).toEqual(rows);
      expect(
        screen.queryByRole('heading', { name: 'Heading' }),
      ).not.toBeInTheDocument();
    },
  );
  it('re-reads metadata and unrelated rows added after editor prefill', async () => {
    setSession(session);
    savePosts([post]);
    mount('/edit/p');
    fill();
    const fresh = { ...post, createdAt: null, authorName: 'Fresh Author' };
    const added = { id: 'new malformed row' };
    savePosts([added, fresh]);
    await save();
    expect(getPosts()).toEqual([
      added,
      { ...fresh, title: 'Heading', content: '  Text\n\tcontent  ' },
    ]);
    expect(screen.getByText('Date unavailable')).toBeVisible();
  });
  it.each(['/write', '/edit/p'])(
    'keeps %s actionable with unchanged storage on quota error and permits explicit retry',
    async (path) => {
      setSession(session);
      savePosts([post]);
      mount(path);
      fill();
      const denied = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(() => {
          throw new DOMException('quota', 'QuotaExceededError');
        });
      await save();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Post could not be saved in this browser. Keep your text, check browser storage space or permissions, and try Save again.',
      );
      expect(screen.getByLabelText('Title')).toHaveValue('  Heading  ');
      expect(screen.getByLabelText('Content')).toHaveValue(
        '  Text\n\tcontent  ',
      );
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
      expect(getPosts()).toEqual([post]);
      denied.mockRestore();
      await save();
      expect(screen.getByRole('heading', { name: 'Heading' })).toBeVisible();
      expect(getPosts()).toHaveLength(path === '/write' ? 2 : 1);
    },
  );
  it('rejects invalid edit content before any persistence', async () => {
    setSession(session);
    savePosts([post]);
    mount('/edit/p');
    fill('Valid', ' ');
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent('Content is required.');
    expect(getPosts()).toEqual([post]);
  });
  it('remains actionable when UUID generation fails without writing', async () => {
    setSession(session);
    mount();
    fill();
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('unavailable');
    });
    await save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Post could not be saved',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(localStorage.getItem('writespace_posts')).toBeNull();
  });
  it.each(['/write', '/edit/p'])(
    'wires the actual App guarded %s route and authenticated shell',
    (path) => {
      setSession(session);
      savePosts([post]);
      render(
        <MemoryRouter
          initialEntries={[path]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <App />
        </MemoryRouter>,
      );
      expect(
        screen.getByRole('navigation', { name: 'Authenticated navigation' }),
      ).toBeVisible();
      expect(screen.getByRole('link', { name: 'All Blogs' })).toHaveAttribute(
        'href',
        '/blogs',
      );
      expect(
        screen.getByRole('link', { name: 'Write', exact: true }),
      ).toHaveAttribute('href', '/write');
      expect(
        screen.getByRole('heading', {
          name: path === '/write' ? 'Write a Post' : 'Edit Post',
        }),
      ).toBeVisible();
      expect(getPosts()).toEqual([post]);
    },
  );
  it.each(['/write', '/edit/p'])(
    'guards real App %s against guests',
    async (path) => {
      savePosts([post]);
      render(
        <MemoryRouter
          initialEntries={[path]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <App />
        </MemoryRouter>,
      );
      expect(
        await screen.findByRole('heading', { name: 'Login' }),
      ).toBeVisible();
      expect(
        screen.queryByRole('navigation', { name: 'Authenticated navigation' }),
      ).not.toBeInTheDocument();
      expect(getPosts()).toEqual([post]);
    },
  );
});
