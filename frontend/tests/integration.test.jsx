/** Verify cross-feature local identity, publishing and account state. */
import { describe, it, expect } from 'vitest';
import { createAccount, createAdminAccount, deleteAdminAccount, managedAccounts } from '../src/utils/accounts.js';
import { authenticate, setSession, clearSession } from '../src/utils/auth.js';
import { createPost, updatePost, deletePost, orderedPosts } from '../src/utils/posts.js';
import { getPosts, getUsers } from '../src/utils/storage.js';

describe('local feature integration', () => {
  it('registers, publishes, updates and deletes without altering account identity', () => {
    const { account } = createAccount({ displayName: 'Mira', username: ' Mira ', password: 'demo-only', confirmPassword: 'demo-only' });
    setSession(authenticate('mira', 'demo-only'));
    const post = createPost('A thought', 'First\n\nSecond');
    expect(orderedPosts()[0].authorId).toBe(account.id);
    updatePost(post.id, 'Revised', 'Kept locally');
    expect(getPosts()[0]).toEqual({ ...post, title: 'Revised', content: 'Kept locally' });
    clearSession();
    expect(() => deletePost(post.id)).toThrow();
    expect(getPosts()).toHaveLength(1);
    setSession(authenticate(' MIRA ', 'demo-only'));
    deletePost(post.id);
    expect(getPosts()).toEqual([]);
    expect(getUsers()).toEqual([account]);
  });

  it('creates an Admin, authenticates it and rejects self deletion across helpers', () => {
    setSession(authenticate('admin', 'admin'));
    const { account } = createAdminAccount({ displayName: 'Rae', username: ' Rae ', password: ' ', role: 'admin' });
    clearSession();
    const identity = authenticate('RAE', ' ');
    expect(identity.userId).toBe(account.id);
    setSession(identity);
    expect(managedAccounts()).toEqual([account]);
    expect(() => deleteAdminAccount(account.id, true)).toThrow('You cannot delete your current account.');
    expect(getUsers()).toEqual([account]);
    setSession(authenticate('admin', 'admin'));
    expect(deleteAdminAccount(account.id, true)).toBe(true);
    expect(authenticate('rae', ' ')).toBeNull();
  });
});
