/** Verify immutable reads, malformed data and fresh-session local deletion. */
import { describe, it, expect, vi } from 'vitest';
import {
  authorRole,
  canManagePost,
  createPost,
  deletePost,
  findEditablePost,
  findPost,
  formatPostDate,
  isPost,
  orderedPosts,
  postTimestamp,
  updatePost,
  validatePostForm,
} from './posts.js';
import { getPosts, savePosts, saveUsers } from './storage.js';
import { clearSession, setSession } from './auth.js';
const post = {
  id: 'p',
  title: 'Title',
  content: 'Text',
  authorId: 'u',
  authorName: 'Rae',
  createdAt: '2025-02-03T00:00:00Z',
};
const session = {
  userId: 'u',
  username: 'rae',
  displayName: 'Rae',
  role: 'user',
};
describe('posts', () => {
  it('accepts plain text and allows unavailable creation metadata', () => {
    expect(isPost(post)).toBe(true);
    expect(isPost({ ...post, createdAt: null })).toBe(true);
  });
  it.each([
    null,
    [],
    {},
    'post',
    ...['id', 'title', 'content', 'authorId', 'authorName'].map((key) => ({
      ...post,
      [key]: {},
    })),
  ])('rejects malformed row %#', (row) => expect(isPost(row)).toBe(false));
  it.each([null, 0, {}, '', ' ', 'not-a-date'])(
    'makes invalid date %# unavailable',
    (date) => {
      expect(postTimestamp(date)).toBeNull();
      expect(formatPostDate(date)).toBe('Date unavailable');
    },
  );
  it('formats real dates with padded days and English months', () => {
    expect(postTimestamp(post.createdAt)).toBe(Date.parse(post.createdAt));
    expect(formatPostDate(post.createdAt)).toBe('Feb 03, 2025');
  });
  it.each([null, {}, 'rows'])('returns empty for non-array %#', (rows) =>
    expect(orderedPosts(rows)).toEqual([]),
  );
  it.each([
    ['equal valid dates, first then second', post.createdAt, post.createdAt, false, ['first', 'second']],
    ['equal valid dates, second then first', post.createdAt, post.createdAt, true, ['second', 'first']],
    ['both unavailable dates, first then second', 'bad', null, false, ['first', 'second']],
    ['both unavailable dates, second then first', 'bad', null, true, ['second', 'first']],
    ['unavailable left date and valid right date', 'bad', '1960-01-01T00:00:00Z', false, ['second', 'first']],
    ['valid left date and unavailable right date', 'bad', '1960-01-01T00:00:00Z', true, ['second', 'first']],
    ['older left date and newer right date', '2020-01-01T00:00:00Z', post.createdAt, false, ['second', 'first']],
    ['newer left date and older right date', '2020-01-01T00:00:00Z', post.createdAt, true, ['second', 'first']],
  ])(
    'orders %s independently without changing input or persisted rows',
    (_case, firstDate, secondDate, reversed, expectedIds) => {
      const first = Object.freeze({ ...post, id: 'first', createdAt: firstDate });
      const second = Object.freeze({ ...post, id: 'second', createdAt: secondDate });
      const rows = Object.freeze(reversed ? [second, first] : [first, second]);
      const originalRows = rows.map((row) => ({ ...row }));
      savePosts(rows);
      const persisted = localStorage.getItem('writespace_posts');

      const result = orderedPosts(rows);
      expect(result.map((row) => row.id)).toEqual(expectedIds);
      expect(result).not.toBe(rows);
      expect(orderedPosts().map((row) => row.id)).toEqual(expectedIds);
      expect(rows).toEqual(originalRows);
      expect(getPosts()).toEqual(originalRows);
      expect(localStorage.getItem('writespace_posts')).toBe(persisted);
    },
  );
  it('sorts copies, preserves ties, filters bad rows and places all invalid dates last', () => {
    const rows = [
      { ...post, id: 'invalid', createdAt: 'bad' },
      { ...post, id: 'old', createdAt: '2020-01-01' },
      null,
      post,
      { ...post, id: 'tie' },
      { ...post, id: 'absent', createdAt: null },
    ];
    savePosts(rows);
    expect(orderedPosts().map((row) => row.id)).toEqual([
      'p',
      'tie',
      'old',
      'invalid',
      'absent',
    ]);
    expect(orderedPosts(Object.freeze(rows))).not.toBe(rows);
    expect(getPosts()).toEqual(rows);
    expect(findPost('p')).toEqual(post);
    expect(findPost('missing')).toBeNull();
  });
  it.each(['{bad', '{}', 'null'])(
    'reads malformed collection %s safely without writes',
    (raw) => {
      localStorage.setItem('writespace_posts', raw);
      expect(orderedPosts()).toEqual([]);
      expect(findPost('p')).toBeNull();
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
    },
  );
  it('recovers inaccessible post reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(orderedPosts()).toEqual([]);
    expect(findPost('p')).toBeNull();
  });
  it.each([
    null,
    {},
    [],
    { ...session, userId: '' },
    { ...session, role: 'unknown' },
    { ...session, userId: 'other' },
  ])('denies invalid or non-owner session %#', (viewer) =>
    expect(canManagePost(viewer, post)).toBe(false),
  );
  it('allows owner and Admin but not malformed posts', () => {
    expect(canManagePost(session, post)).toBe(true);
    expect(
      canManagePost({ ...session, role: 'admin', userId: 'other' }, post),
    ).toBe(true);
    expect(canManagePost(session, null)).toBe(false);
  });
  it('resolves built-in and registered Admin author icons without schema drift', () => {
    saveUsers([
      null,
      [],
      {},
      { id: 'a', role: 'admin' },
      { id: 'u', role: 'user' },
    ]);
    expect(authorRole({ ...post, authorId: 'admin' })).toBe('admin');
    expect(authorRole({ ...post, authorId: 'a' })).toBe('admin');
    expect(authorRole(post)).toBe('user');
    expect(authorRole({ ...post, authorId: 'missing' })).toBe('user');
    expect(authorRole(null)).toBe('user');
  });
  it.each(['user', 'admin'])(
    'deletes for %s and preserves every unrelated row',
    (role) => {
      const rows = [null, post, { ...post, id: 'other' }, { corrupt: true }];
      savePosts(rows);
      setSession({
        ...session,
        role,
        userId: role === 'admin' ? 'admin' : 'u',
      });
      deletePost('p');
      expect(getPosts()).toEqual([null, rows[2], rows[3]]);
    },
  );
  it('re-reads ownership and current session before any write', () => {
    savePosts([post]);
    setSession(session);
    savePosts([{ ...post, authorId: 'other' }]);
    expect(() => deletePost('p')).toThrow('You cannot delete this post.');
    expect(getPosts()).toEqual([{ ...post, authorId: 'other' }]);
    savePosts([post]);
    clearSession();
    expect(() => deletePost('p')).toThrow('You cannot delete this post.');
    expect(getPosts()).toEqual([post]);
  });
  it.each([[[]], [[post, post]], [[{ ...post, content: null }]]])(
    'rejects missing, ambiguous or corrupt targets %#',
    (rows) => {
      savePosts(rows);
      setSession(session);
      expect(() => deletePost('p')).toThrow('Post not found.');
      expect(getPosts()).toEqual(rows);
    },
  );
  it('propagates failed writes and retains persisted records', () => {
    savePosts([post]);
    setSession(session);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => deletePost('p')).toThrow('quota');
    expect(getPosts()).toEqual([post]);
  });
});

/** Verify new writing operations against actual local JSON, including stale state. */
describe('writing helpers', () => {
  it('accepts whitespace-preserved and long content without side effects', () => {
    const content =
      '  <script>plain text</script>\n\t' + 'x'.repeat(100000) + '  ';
    expect(validatePostForm(' Title ', content)).toEqual({});
    expect(localStorage.getItem('writespace_posts')).toBeNull();
  });
  it.each(
    [undefined, null, 1, false, [], {}, '', ' \n\t '].map((value) => [value]),
  )('rejects invalid title or content %# without writes', (value) => {
    expect(validatePostForm(value, 'Text')).toEqual({
      title: 'Title is required.',
    });
    expect(validatePostForm('Title', value)).toEqual({
      content: 'Content is required.',
    });
    expect(validatePostForm(value, value)).toEqual({
      title: 'Title is required.',
      content: 'Content is required.',
    });
    setSession(session);
    savePosts([post]);
    expect(() => createPost(value, 'Text')).toThrow('Title is required.');
    expect(() => createPost('Title', value)).toThrow('Content is required.');
    expect(() => updatePost('p', value, 'Text')).toThrow('Title is required.');
    expect(() => updatePost('p', 'Title', value)).toThrow(
      'Content is required.',
    );
    expect(getPosts()).toEqual([post]);
  });
  it.each(['user', 'admin'])(
    'creates exact UUID/date schema for current %s with untouched content and rows',
    (role) => {
      const rows = [null, post, { broken: true }, ['legacy'], 42];
      savePosts(rows);
      setSession({
        ...session,
        role,
        userId: role === 'admin' ? 'admin' : 'u',
      });
      const content = '  \n\t' + 'x'.repeat(100000) + '\n  ';
      const before = Date.now();
      const created = createPost('  Heading  ', content);
      expect(created).toEqual({
        id: expect.any(String),
        createdAt: expect.any(String),
        title: 'Heading',
        content,
        authorId: role === 'admin' ? 'admin' : 'u',
        authorName: 'Rae',
      });
      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
      expect(Date.parse(created.createdAt)).toBeGreaterThanOrEqual(before);
      expect(Date.parse(created.createdAt)).toBeLessThanOrEqual(Date.now());
      expect(getPosts()).toEqual([...rows, created]);
      const second = createPost('Second', 'Text');
      expect(second.id).not.toBe(created.id);
      expect(getPosts()).toEqual([...rows, created, second]);
    },
  );
  it.each([
    null,
    '{}',
    '{bad',
    '[]',
    JSON.stringify({ ...session, role: 'unknown' }),
    JSON.stringify({ ...session, displayName: '' }),
  ])('rejects absent or invalid fresh session %# for both mutations', (raw) => {
    savePosts([post]);
    if (raw !== null) localStorage.setItem('writespace_session', raw);
    expect(() => createPost('Title', 'Text')).toThrow('Sign in again');
    expect(() => updatePost('p', 'Title', 'Text')).toThrow('Sign in again');
    expect(getPosts()).toEqual([post]);
  });
  it('uses the current identity rather than an earlier creator session', () => {
    setSession(session);
    setSession({ ...session, userId: 'new', displayName: 'New Writer' });
    const created = createPost('Title', 'Text');
    expect(created.authorId).toBe('new');
    expect(created.authorName).toBe('New Writer');
  });
  it.each([null, undefined, 0, {}, [], '', ' '])(
    'rejects invalid lookup identity %# without side effects',
    (id) => {
      savePosts([post]);
      setSession(session);
      expect(findEditablePost(id)).toBeNull();
      expect(() => updatePost(id, 'Title', 'Text')).toThrow('Post not found.');
      expect(getPosts()).toEqual([post]);
    },
  );
  it.each(
    [
      [],
      [post, post],
      [post, { id: 'p' }],
      [{ ...post, content: null }],
      [null, [], {}, 1],
    ].map((rows) => [rows]),
  )('rejects missing corrupt and duplicate targets %# unchanged', (rows) => {
    savePosts(rows);
    setSession(session);
    expect(findEditablePost('p')).toBeNull();
    expect(() => updatePost('p', 'Revised', 'Text')).toThrow('Post not found.');
    expect(getPosts()).toEqual(rows);
  });
  it.each(['user', 'admin'])(
    'updates one target for %s preserving original identity/date/author and malformed rows',
    (role) => {
      const rows = [
        null,
        post,
        { ...post, id: 'other' },
        { id: 'corrupt', content: {} },
        ['row'],
        false,
      ];
      savePosts(rows);
      setSession({
        ...session,
        role,
        userId: role === 'admin' ? 'admin' : 'u',
        displayName: 'Changed Name',
      });
      expect(findEditablePost('p')).toEqual(post);
      expect(getPosts()).toEqual(rows);
      const content = '  Edited\n\t' + 'x'.repeat(100000) + '  ';
      const updated = updatePost('p', ' Revised ', content);
      expect(updated).toEqual({ ...post, title: 'Revised', content });
      expect(getPosts()).toEqual([null, updated, ...rows.slice(2)]);
    },
  );
  it('re-reads current target, unrelated additions and metadata before replacing', () => {
    savePosts([post]);
    setSession(session);
    const fresh = { ...post, createdAt: null, authorName: 'Fresh Author' };
    const added = { id: 'new-row' };
    savePosts([added, fresh]);
    expect(updatePost('p', 'Revised', 'Exact')).toEqual({
      ...fresh,
      title: 'Revised',
      content: 'Exact',
    });
    expect(getPosts()).toEqual([
      added,
      { ...fresh, title: 'Revised', content: 'Exact' },
    ]);
  });
  it('rejects non-owner and changed current identity or post owner without writes', () => {
    savePosts([post]);
    setSession({ ...session, userId: 'other' });
    expect(() => updatePost('p', 'Revised', 'Text')).toThrow(
      'You cannot edit this post.',
    );
    expect(getPosts()).toEqual([post]);
    setSession(session);
    savePosts([{ ...post, authorId: 'other' }]);
    expect(() => updatePost('p', 'Revised', 'Text')).toThrow(
      'You cannot edit this post.',
    );
    expect(getPosts()).toEqual([{ ...post, authorId: 'other' }]);
  });
  it('fails closed when session reads throw', () => {
    savePosts([post]);
    setSession(session);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => createPost('Title', 'Text')).toThrow('Sign in again');
    expect(() => updatePost('p', 'Title', 'Text')).toThrow('Sign in again');
  });
  it.each(['{bad', '{}', 'null'])(
    'uses existing malformed-collection fallback %s only on explicit create',
    (raw) => {
      localStorage.setItem('writespace_posts', raw);
      setSession(session);
      expect(findEditablePost('p')).toBeNull();
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
      expect(() => updatePost('p', 'Title', 'Text')).toThrow('Post not found.');
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
      const created = createPost('Title', 'Text');
      expect(getPosts()).toEqual([created]);
    },
  );
  it('propagates UUID failure without writing', () => {
    setSession(session);
    savePosts([post]);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('UUID unavailable');
    });
    expect(() => createPost('Title', 'Text')).toThrow('UUID unavailable');
    expect(getPosts()).toEqual([post]);
  });
  it.each(['create', 'update'])(
    'propagates quota errors for %s and leaves all persisted keys intact',
    (operation) => {
      savePosts([post]);
      saveUsers([{ id: 'account' }]);
      setSession(session);
      const originalPosts = localStorage.getItem('writespace_posts');
      const originalUsers = localStorage.getItem('writespace_users');
      const originalSession = localStorage.getItem('writespace_session');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      expect(() =>
        operation === 'create'
          ? createPost('Revised', 'Text')
          : updatePost('p', 'Revised', 'Text'),
      ).toThrow('quota');
      expect(localStorage.getItem('writespace_posts')).toBe(originalPosts);
      expect(localStorage.getItem('writespace_users')).toBe(originalUsers);
      expect(localStorage.getItem('writespace_session')).toBe(originalSession);
    },
  );
});
