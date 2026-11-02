/** Exercise explicit registration, real stored state and both persistence boundaries. */
import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RegisterPage from './RegisterPage.jsx';
import LoginPage from './LoginPage.jsx';
import App from '../App.jsx';
import { getSession, setSession } from '../utils/auth.js';
import { getUsers, saveUsers } from '../utils/storage.js';

const valid = {
  displayName: '  Rae Reader  ',
  username: '  Rae  ',
  password: ' demo-only ',
  confirmPassword: ' demo-only ',
};
const labels = {
  displayName: 'Display name',
  username: 'Username',
  password: 'Password',
  confirmPassword: 'Confirm password',
};

/** Mount the page with observable destinations, keeping production route table separate. */
function mount() {
  return render(
    <StrictMode>
      <MemoryRouter
        initialEntries={['/register']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/blogs" element={<p>User home</p>} />
          <Route path="/admin" element={<p>Admin home</p>} />
          <Route path="/" element={<p>Public home</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Fill each native input, then activate the explicit submit control. */
async function register(form = valid) {
  const actor = userEvent.setup();
  for (const [field, label] of Object.entries(labels)) {
    if (form[field])
      await actor.type(screen.getByLabelText(label), form[field]);
  }
  await actor.click(
    screen.getByRole('button', { name: 'Register', exact: true }),
  );
}

describe('RegisterPage', () => {
  it('renders required accessible fields and unsafe guidance without writes on render or input', async () => {
    const view = mount();
    for (const label of Object.values(labels)) {
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
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    );
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(screen.queryByLabelText(/email|role/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Do not use real passwords/)).toBeVisible();
    await userEvent.setup().type(screen.getByLabelText('Username'), 'Rae');
    view.rerender(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(localStorage.getItem('writespace_users')).toBeNull();
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });
  it.each([
    ['displayName', '  ', 'Display name is required.'],
    ['username', '  ', 'Username is required.'],
    ['password', '', 'Password is required.'],
    ['confirmPassword', '', 'Confirm password is required.'],
  ])(
    'shows individually missing %s with associated inline error and no persistence',
    async (field, value, message) => {
      mount();
      await register({ ...valid, [field]: value });
      expect(screen.getByText(message)).toHaveAttribute('role', 'alert');
      expect(screen.getByLabelText(labels[field])).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.getByLabelText(labels[field])).toHaveAttribute(
        'aria-describedby',
        `${field}-error`,
      );
      expect(getUsers()).toEqual([]);
      expect(getSession()).toBeNull();
      expect(screen.getByRole('heading', { name: 'Register' })).toBeVisible();
    },
  );
  it('shows all missing fields on empty submit', async () => {
    mount();
    await register({});
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it('rejects mismatch without normalizing passwords', async () => {
    mount();
    await register({ ...valid, confirmPassword: 'demo-only' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Passwords do not match.',
    );
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
      'aria-describedby',
      'confirmPassword-error',
    );
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
  it.each(['admin', 'ADMIN', '  AdMiN  '])(
    'rejects reserved username %j',
    async (username) => {
      mount();
      await register({ ...valid, username });
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This username is reserved.',
      );
      expect(getUsers()).toEqual([]);
      expect(getSession()).toBeNull();
    },
  );
  it('rejects stored whitespace/case duplicate and preserves all stored records', async () => {
    const old = { id: 'old', username: '  rAE  ', role: 'user' };
    saveUsers([old]);
    mount();
    await register(valid);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This username already exists.',
    );
    expect(getUsers()).toEqual([old]);
    expect(getSession()).toBeNull();
  });
  it('clears field errors after correction, saves exact schema and canonical session before navigation', async () => {
    const old = { username: 'other' };
    saveUsers([old]);
    mount();
    await register({});
    await register(valid);
    expect(screen.getByText('User home')).toBeVisible();
    const account = getUsers()[1];
    expect(account).toEqual({
      id: expect.any(String),
      createdAt: expect.any(String),
      displayName: 'Rae Reader',
      username: 'Rae',
      password: ' demo-only ',
      role: 'user',
    });
    expect(getUsers()).toEqual([old, account]);
    expect(getSession()).toEqual({
      userId: account.id,
      displayName: 'Rae Reader',
      username: 'Rae',
      role: 'user',
    });
    expect(JSON.parse(localStorage.getItem('writespace_session'))).toEqual(
      getSession(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('account write failure preserves existing state, keeps inputs and never attempts session', async () => {
    const old = { username: 'other' };
    saveUsers([old]);
    mount();
    const original = Storage.prototype.setItem;
    const writes = [];
    const denied = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (key, value) {
        writes.push(key);
        if (key === 'writespace_users') throw new Error('quota');
        original.call(this, key, value);
      });
    await register(valid);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Account could not be saved in this browser.',
    );
    expect(getUsers()).toEqual([old]);
    expect(getSession()).toBeNull();
    expect(writes).not.toContain('writespace_session');
    expect(screen.getByLabelText('Username')).toHaveValue('  Rae  ');
    expect(screen.getByLabelText('Password')).toHaveValue(' demo-only ');
    denied.mockRestore();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByText('User home')).toBeVisible();
    expect(getUsers()).toHaveLength(2);
  });
  it('session failure leaves account saved, explains partial success and permits real login recovery', async () => {
    mount();
    const original = Storage.prototype.setItem;
    const denied = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function (key, value) {
        if (key === 'writespace_session') throw new Error('quota');
        original.call(this, key, value);
      });
    await register(valid);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your account exists in this browser, but sign-in did not complete.',
    );
    const account = getUsers()[0];
    expect(account.username).toBe('Rae');
    expect(account.password).toBe(' demo-only ');
    expect(getSession()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Register' })).toBeVisible();
    denied.mockRestore();
    const actor = userEvent.setup();
    await actor.click(screen.getByRole('link', { name: 'Login' }));
    await actor.type(screen.getByLabelText('Username'), ' rAE ');
    await actor.type(screen.getByLabelText('Password'), ' demo-only ');
    await actor.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByText('User home')).toBeVisible();
    expect(getUsers()).toEqual([account]);
    expect(getSession().userId).toBe(account.id);
  });
  it.each(['user', 'admin'])(
    'redirects logged-in %s without render actions or session rewrites',
    (role) => {
      const session = {
        userId: 'u',
        username: 'Rae',
        displayName: 'Rae Reader',
        role,
      };
      const users = [{ username: 'Rae' }];
      saveUsers(users);
      setSession(session);
      mount();
      expect(
        screen.getByText(role === 'admin' ? 'Admin home' : 'User home'),
      ).toBeVisible();
      expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
      expect(getUsers()).toEqual(users);
      expect(getSession()).toEqual(session);
    },
  );
  it('treats malformed session as guest without changing storage on render', () => {
    localStorage.setItem('writespace_session', '{bad');
    mount();
    expect(screen.getByLabelText('Username')).toBeVisible();
    expect(localStorage.getItem('writespace_session')).toBe('{bad');
    expect(localStorage.getItem('writespace_users')).toBeNull();
  });
  it('navigates from Login to Register and then home through the brand link in App', async () => {
    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Register' })).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: 'WriteSpace' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'WriteSpace' }),
    ).toBeVisible();
  });
  it('navigates home only through the explicit brand link without creating an account', async () => {
    mount();
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: 'WriteSpace' }));
    expect(screen.getByText('Public home')).toBeVisible();
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });
});
