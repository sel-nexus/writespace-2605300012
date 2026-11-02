/** Verify fail-closed identities and canonical local credential matching. */
import { describe, it, expect, vi } from 'vitest';
import { authenticate, getSession, setSession, clearSession } from './auth.js';
import { saveUsers, getUsers } from './storage.js';
const user = {
  userId: 'u1',
  username: 'Rae',
  displayName: 'Rae Reader',
  role: 'user',
};
const account = {
  id: 'u1',
  username: '  Rae  ',
  displayName: 'Rae Reader',
  password: ' demo-only ',
  role: 'user',
  createdAt: '2024-01-01T00:00:00Z',
};
const invalidSessions = [
  null,
  [],
  'text',
  5,
  true,
  {},
  { ...user, role: 'owner' },
  { ...user, role: null },
  ...['userId', 'username', 'displayName'].flatMap((key) => [
    { ...user, [key]: '' },
    { ...user, [key]: '  ' },
    { ...user, [key]: 1 },
    { ...user, [key]: null },
    Object.fromEntries(Object.entries(user).filter(([name]) => name !== key)),
  ]),
];
describe('local session', () => {
  it('returns null for absent and corrupt serialized identity', () => {
    expect(getSession()).toBeNull();
    localStorage.setItem('writespace_session', '{bad');
    expect(getSession()).toBeNull();
  });
  it.each(invalidSessions)('fails closed for invalid shape %#', (value) => {
    localStorage.setItem('writespace_session', JSON.stringify(value));
    expect(getSession()).toBeNull();
    expect(() => setSession(value)).toThrow('Invalid session.');
  });
  it.each(['admin', 'user'])(
    'round trips %s identity without extra fields',
    (role) => {
      setSession({ ...user, role, password: 'must-not-persist' });
      expect(getSession()).toEqual({ ...user, role });
      expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual({
        ...user,
        role,
      });
    },
  );
  it('fails closed when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(getSession()).toBeNull();
  });
  it('propagates failed session writes and retains the prior session', () => {
    setSession(user);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => setSession({ ...user, role: 'admin' })).toThrow('quota');
    expect(getSession()).toEqual(user);
  });
  it('clears only session and is safe when already absent', () => {
    setSession(user);
    saveUsers([account]);
    clearSession();
    clearSession();
    expect(getSession()).toBeNull();
    expect(getUsers()).toEqual([account]);
  });
  it('propagates removal failure with identity unchanged', () => {
    setSession(user);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(clearSession).toThrow('denied');
    expect(getSession()).toEqual(user);
  });
});
describe('credential matching', () => {
  it.each(['admin', 'ADMIN', '  AdMiN  '])(
    'gives fixed Admin precedence for %s',
    (name) => {
      saveUsers([{ ...account, username: ' ADMIN ', password: 'admin' }]);
      expect(authenticate(name, 'admin')).toEqual({
        userId: 'admin',
        username: 'admin',
        displayName: 'Admin',
        role: 'admin',
      });
      expect(getSession()).toBeNull();
    },
  );
  it('rejects reserved Admin collision with a different password', () => {
    saveUsers([{ ...account, username: 'admin', password: 'impostor' }]);
    expect(authenticate('admin', 'impostor')).toBeNull();
    expect(authenticate('admin', ' admin ')).toBeNull();
  });
  it.each(['user', 'admin'])(
    'matches legacy canonical username for local %s without rewriting account',
    (role) => {
      saveUsers([{ ...account, role }]);
      expect(authenticate(' rAE ', ' demo-only ')).toEqual({ ...user, role });
      expect(getUsers()).toEqual([{ ...account, role }]);
      expect(getSession()).toBeNull();
    },
  );
  it.each([
    [null, 'x'],
    [1, 'x'],
    ['Rae', null],
    ['Rae', 1],
    ['', 'x'],
    ['  ', 'x'],
    ['Rae', ''],
  ])('rejects invalid submitted values %#', (name, password) => {
    saveUsers([account]);
    expect(authenticate(name, password)).toBeNull();
  });
  it.each(['demo-only', ' DEMO-ONLY ', 'wrong'])(
    'does not normalize password %s',
    (password) => {
      saveUsers([account]);
      expect(authenticate('Rae', password)).toBeNull();
    },
  );
  it('rejects absent, corrupt and non-array account stores', () => {
    expect(authenticate('Rae', 'demo-only')).toBeNull();
    for (const raw of ['{bad', '{}']) {
      localStorage.setItem('writespace_users', raw);
      expect(authenticate('Rae', 'demo-only')).toBeNull();
    }
  });
  it('still allows built-in Admin when account reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(authenticate('Rae', 'demo-only')).toBeNull();
    expect(authenticate('admin', 'admin').role).toBe('admin');
  });
  it.each([
    null,
    4,
    'junk',
    {},
    { ...account, username: 4 },
    { ...account, id: null },
    { ...account, displayName: '' },
    { ...account, role: 'owner' },
    { ...account, password: null },
  ])('ignores malformed local account %#', (row) => {
    saveUsers([row]);
    expect(authenticate('Rae', ' demo-only ')).toBeNull();
  });
  it('skips malformed rows and unmatched names before a valid match', () => {
    saveUsers([null, { ...account, username: 'Other' }, account]);
    expect(authenticate('Rae', ' demo-only ')).toEqual(user);
    expect(authenticate('Nobody', ' demo-only ')).toBeNull();
  });
});
