/** Exercise real local login validation, role redirects and write failures. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import { getSession, setSession } from '../utils/auth.js';
import { saveUsers, getUsers } from '../utils/storage.js';
/** Mount login with observable role destinations to prove redirect behavior. */
function mount() {
  render(
    <MemoryRouter
      initialEntries={['/login']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<p>Admin home</p>} />
        <Route path="/blogs" element={<p>User home</p>} />
        <Route path="/register" element={<p>Register destination</p>} />
        <Route path="/" element={<p>Public home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
/** Enter explicit credentials through native fields and submit. */
async function login(username, password) {
  const actor = userEvent.setup();
  if (username) await actor.type(screen.getByLabelText('Username'), username);
  if (password) await actor.type(screen.getByLabelText('Password'), password);
  await actor.click(screen.getByRole('button', { name: 'Login' }));
}
describe('LoginPage', () => {
  it('renders labelled required fields, native password semantics and explicit unsafe guidance', () => {
    mount();
    expect(screen.getByLabelText('Username')).toBeRequired();
    expect(screen.getByLabelText('Username')).toHaveAttribute(
      'autocomplete',
      'username',
    );
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getByLabelText('Username')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(screen.getByText(/username admin \/ password admin/)).toBeVisible();
    expect(screen.getByText(/Do not use real passwords/)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getSession()).toBeNull();
  });
  it.each([
    ['', '', true, true],
    [' ', 'demo-only', true, false],
    ['demo', '', false, true],
  ])(
    'validates required fields independently %#',
    async (username, password, missingName, missingPassword) => {
      mount();
      await login(username, password);
      expect(screen.getByLabelText('Username')).toHaveAttribute(
        'aria-invalid',
        String(missingName),
      );
      expect(screen.getByLabelText('Password')).toHaveAttribute(
        'aria-invalid',
        String(missingPassword),
      );
      if (missingName) {
        expect(screen.getByText('Username is required.')).toHaveAttribute(
          'role',
          'alert',
        );
        expect(screen.getByLabelText('Username')).toHaveAttribute(
          'aria-describedby',
          'username-error',
        );
      }
      if (missingPassword) {
        expect(screen.getByText('Password is required.')).toHaveAttribute(
          'role',
          'alert',
        );
        expect(screen.getByLabelText('Password')).toHaveAttribute(
          'aria-describedby',
          'password-error',
        );
      }
      expect(getSession()).toBeNull();
    },
  );
  it('shows exact inline invalid-credential copy and no persisted session', async () => {
    mount();
    await login('nobody', 'demo-only');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid username or password.',
    );
    for (const label of ['Username', 'Password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.getByLabelText(label)).toHaveAttribute(
        'aria-describedby',
        'login-error',
      );
    }
    expect(getSession()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Login' })).toBeVisible();
  });
  it('clears errors after correction and persists built-in Admin before redirect', async () => {
    mount();
    await login('', '');
    await login('  ADMIN ', 'admin');
    expect(screen.getByText('Admin home')).toBeVisible();
    expect(getSession()).toEqual({
      userId: 'admin',
      username: 'admin',
      displayName: 'Admin',
      role: 'admin',
    });
  });
  it.each(['user', 'admin'])(
    'persists canonical legacy %s account then redirects to role home',
    async (role) => {
      const account = {
        id: 'demo-id',
        displayName: 'Local Reader',
        username: '  Rae  ',
        password: ' demo-only ',
        role,
        createdAt: '2024-01-01T00:00:00Z',
      };
      saveUsers([account]);
      mount();
      await login(' rAE ', ' demo-only ');
      expect(
        screen.getByText(role === 'admin' ? 'Admin home' : 'User home'),
      ).toBeVisible();
      expect(getSession()).toEqual({
        userId: 'demo-id',
        username: 'Rae',
        displayName: 'Local Reader',
        role,
      });
      expect(getUsers()).toEqual([account]);
    },
  );
  it.each(['user', 'admin'])(
    'redirects already-authenticated %s without rendering or rewriting the login form',
    (role) => {
      const session = {
        userId: 'u',
        username: 'u',
        displayName: 'Local Reader',
        role,
      };
      setSession(session);
      mount();
      expect(
        screen.getByText(role === 'admin' ? 'Admin home' : 'User home'),
      ).toBeVisible();
      expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
      expect(getSession()).toEqual(session);
    },
  );
  it('renders guest form for malformed session rather than redirecting', () => {
    localStorage.setItem('writespace_session', '{bad');
    mount();
    expect(screen.getByLabelText('Username')).toBeVisible();
  });
  it('reports session write failure, retains inputs, then supports a successful retry', async () => {
    mount();
    const denied = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota');
      });
    await login('admin', 'admin');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sign-in could not be saved in this browser.',
    );
    expect(screen.getByLabelText('Username')).toHaveValue('admin');
    expect(screen.getByLabelText('Password')).toHaveValue('admin');
    expect(getSession()).toBeNull();
    expect(screen.queryByText('Admin home')).not.toBeInTheDocument();
    denied.mockRestore();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('Admin home')).toBeVisible();
    expect(getSession().role).toBe('admin');
  });
  it('fails gracefully with inaccessible reads and invalid credentials', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    mount();
    await login('Rae', 'demo-only');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid username or password.',
    );
  });
  it.each([
    ['Register', 'Register destination'],
    ['WriteSpace', 'Public home'],
  ])('navigates via %s link', async (label, destination) => {
    mount();
    await userEvent.setup().click(screen.getByRole('link', { name: label }));
    expect(screen.getByText(destination)).toBeVisible();
  });
});
