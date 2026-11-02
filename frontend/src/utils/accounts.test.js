/** Verify registration branches against real jsdom storage snapshots. */
import { describe, it, expect, vi } from 'vitest';
import { createAccount, validateRegistration } from './accounts.js';
import { getUsers, saveUsers } from './storage.js';
import { getSession } from './auth.js';

const valid = {
  displayName: '  Rae Reader  ',
  username: '  Rae  ',
  password: ' demo-only ',
  confirmPassword: ' demo-only ',
};

describe('validateRegistration', () => {
  it('accepts complete fields without modifying input or stored users', () => {
    const users = [{ username: 'other' }];
    expect(validateRegistration(valid, users)).toEqual({});
    expect(valid.username).toBe('  Rae  ');
    expect(users).toEqual([{ username: 'other' }]);
  });
  it.each([
    ['displayName', '   ', 'Display name is required.'],
    ['username', '   ', 'Username is required.'],
    ['password', '', 'Password is required.'],
    ['confirmPassword', '', 'Confirm password is required.'],
  ])('rejects missing %s independently', (field, value, message) => {
    expect(validateRegistration({ ...valid, [field]: value }, [])[field]).toBe(
      message,
    );
  });
  it('reports every missing field in one submission', () => {
    expect(
      validateRegistration(
        { displayName: '', username: '', password: '', confirmPassword: '' },
        [],
      ),
    ).toEqual({
      displayName: 'Display name is required.',
      username: 'Username is required.',
      password: 'Password is required.',
      confirmPassword: 'Confirm password is required.',
    });
  });
  it('compares exact passwords including whitespace and case', () => {
    expect(
      validateRegistration({ ...valid, confirmPassword: 'demo-only' }, []),
    ).toEqual({ confirmPassword: 'Passwords do not match.' });
    expect(
      validateRegistration({ ...valid, confirmPassword: ' DEMO-only ' }, []),
    ).toEqual({ confirmPassword: 'Passwords do not match.' });
  });
  it.each(['admin', 'ADMIN', '  AdMiN  ', '\tadmin\n'])(
    'rejects reserved variant %j',
    (username) => {
      expect(validateRegistration({ ...valid, username }, [])).toEqual({
        username: 'This username is reserved.',
      });
    },
  );
  it.each([
    ['rae', 'Rae'],
    ['  RAE  ', ' rae '],
    [' i ', ' I '],
  ])(
    'compares submitted %j and stored %j trimmed in en-US',
    (username, stored) => {
      expect(
        validateRegistration({ ...valid, username }, [{ username: stored }]),
      ).toEqual({ username: 'This username already exists.' });
    },
  );
  it('ignores malformed username rows without crashing or rejecting unrelated names', () => {
    expect(
      validateRegistration(valid, [
        null,
        {},
        { username: 7 },
        { username: 'other' },
      ]),
    ).toEqual({});
  });
});

describe('createAccount', () => {
  it('appends canonical user-only UUID/ISO schema without touching password or session', () => {
    const existing = { id: 'old', username: 'other' };
    saveUsers([existing]);
    const { account, errors } = createAccount({
      ...valid,
      role: 'admin',
      email: 'not-saved',
    });
    expect(errors).toEqual({});
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
    expect(getUsers()).toEqual([existing, account]);
    expect(JSON.parse(localStorage.getItem('writespace_users'))).toEqual([
      existing,
      account,
    ]);
    expect(getSession()).toBeNull();
  });
  it('rejects invalid form without any persisted account or session', () => {
    expect(createAccount({ ...valid, username: ' admin ' })).toEqual({
      errors: { username: 'This username is reserved.' },
      account: null,
    });
    expect(localStorage.getItem('writespace_users')).toBeNull();
    expect(getSession()).toBeNull();
  });
  it('re-reads current users for each action and rejects the second canonical collision', () => {
    const first = createAccount(valid).account;
    expect(createAccount({ ...valid, username: ' raE ' }).account).toBeNull();
    expect(getUsers()).toEqual([first]);
  });
  it('propagates account write failure while preserving previous rows and no session', () => {
    const existing = { username: 'other' };
    saveUsers([existing]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => createAccount(valid)).toThrow('quota');
    expect(getUsers()).toEqual([existing]);
    expect(getSession()).toBeNull();
  });
});
