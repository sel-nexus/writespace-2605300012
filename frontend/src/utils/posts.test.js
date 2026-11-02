/** Verify immutable reads, malformed data and fresh-session local deletion. */
import { describe, it, expect, vi } from 'vitest';
import { authorRole, canManagePost, deletePost, findPost, formatPostDate, isPost, orderedPosts, postTimestamp } from './posts.js';
import { getPosts, savePosts, saveUsers } from './storage.js';
import { clearSession, setSession } from './auth.js';
const post = { id: 'p', title: 'Title', content: 'Text', authorId: 'u', authorName: 'Rae', createdAt: '2025-02-03T00:00:00Z' };
const session = { userId: 'u', username: 'rae', displayName: 'Rae', role: 'user' };
describe('posts', () => {
  it('accepts plain text and allows unavailable creation metadata', () => {
    expect(isPost(post)).toBe(true);
    expect(isPost({ ...post, createdAt: null })).toBe(true);
  });
  it.each([null, [], {}, 'post', ...['id', 'title', 'content', 'authorId', 'authorName'].map((key) => ({ ...post, [key]: {} }))])(
    'rejects malformed row %#', (row) => expect(isPost(row)).toBe(false),
  );
  it.each([null, 0, {}, '', ' ', 'not-a-date'])( 'makes invalid date %# unavailable', (date) => {
    expect(postTimestamp(date)).toBeNull();
    expect(formatPostDate(date)).toBe('Date unavailable');
  });
  it('formats real dates with padded days and English months', () => {
    expect(postTimestamp(post.createdAt)).toBe(Date.parse(post.createdAt));
    expect(formatPostDate(post.createdAt)).toBe('Feb 03, 2025');
  });
  it.each([null, {}, 'rows'])( 'returns empty for non-array %#', (rows) => expect(orderedPosts(rows)).toEqual([]));
  it('sorts copies, preserves ties, filters bad rows and places all invalid dates last', () => {
    const rows = [
      { ...post, id: 'invalid', createdAt: 'bad' },
      { ...post, id: 'old', createdAt: '2020-01-01' }, null,
      post, { ...post, id: 'tie' }, { ...post, id: 'absent', createdAt: null },
    ];
    savePosts(rows);
    expect(orderedPosts().map((row) => row.id)).toEqual(['p', 'tie', 'old', 'invalid', 'absent']);
    expect(orderedPosts(Object.freeze(rows))).not.toBe(rows);
    expect(getPosts()).toEqual(rows);
    expect(findPost('p')).toEqual(post);
    expect(findPost('missing')).toBeNull();
  });
  it.each(['{bad', '{}', 'null'])( 'reads malformed collection %s safely without writes', (raw) => {
    localStorage.setItem('writespace_posts', raw);
    expect(orderedPosts()).toEqual([]);
    expect(findPost('p')).toBeNull();
    expect(localStorage.getItem('writespace_posts')).toBe(raw);
  });
  it('recovers inaccessible post reads', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(orderedPosts()).toEqual([]);
    expect(findPost('p')).toBeNull();
  });
  it.each([null, {}, [], { ...session, userId: '' }, { ...session, role: 'unknown' }, { ...session, userId: 'other' }])(
    'denies invalid or non-owner session %#', (viewer) => expect(canManagePost(viewer, post)).toBe(false),
  );
  it('allows owner and Admin but not malformed posts', () => {
    expect(canManagePost(session, post)).toBe(true);
    expect(canManagePost({ ...session, role: 'admin', userId: 'other' }, post)).toBe(true);
    expect(canManagePost(session, null)).toBe(false);
  });
  it('resolves built-in and registered Admin author icons without schema drift', () => {
    saveUsers([null, [], {}, { id: 'a', role: 'admin' }, { id: 'u', role: 'user' }]);
    expect(authorRole({ ...post, authorId: 'admin' })).toBe('admin');
    expect(authorRole({ ...post, authorId: 'a' })).toBe('admin');
    expect(authorRole(post)).toBe('user');
    expect(authorRole({ ...post, authorId: 'missing' })).toBe('user');
    expect(authorRole(null)).toBe('user');
  });
  it.each(['user', 'admin'])( 'deletes for %s and preserves every unrelated row', (role) => {
    const rows = [null, post, { ...post, id: 'other' }, { corrupt: true }];
    savePosts(rows);
    setSession({ ...session, role, userId: role === 'admin' ? 'admin' : 'u' });
    deletePost('p');
    expect(getPosts()).toEqual([null, rows[2], rows[3]]);
  });
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
  it.each([[[]], [[post, post]], [[{ ...post, content: null }]]])('rejects missing, ambiguous or corrupt targets %#', (rows) => {
    savePosts(rows);
    setSession(session);
    expect(() => deletePost('p')).toThrow('Post not found.');
    expect(getPosts()).toEqual(rows);
  });
  it('propagates failed writes and retains persisted records', () => {
    savePosts([post]);
    setSession(session);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => deletePost('p')).toThrow('quota');
    expect(getPosts()).toEqual([post]);
  });
});
