/** Verify native menu interaction, role links and failure-aware explicit logout. */
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar.jsx';
import App from '../App.jsx';
import { getSession, setSession } from '../utils/auth.js';
import { savePosts, getPosts } from '../utils/storage.js';
const session = { userId: 'u', username: 'u', displayName: 'Rae', role: 'user' };
/** Render navigation against real routing and storage. */
function mount(role = 'user') {
  setSession({ ...session, role });
  render(
    <MemoryRouter initialEntries={['/blogs']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Navbar session={{ ...session, role }} />
    </MemoryRouter>,
  );
}
it.each(['user', 'admin'])('renders role links, avatar and active aria-current for %s', (role) => {
  mount(role);
  expect(screen.getByRole('link', { name: 'WriteSpace' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Write' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
  expect(screen.getByRole('img', { name: role === 'admin' ? 'Admin avatar' : 'User avatar' })).toBeVisible();
  if (role === 'admin') expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
  else expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
});
it('opens and closes both panels without logging out and resets them on navigation', async () => {
  mount();
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: 'Open navigation' }));
  expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById('authenticated-links')).toHaveClass('flex');
  await actor.click(screen.getByRole('button', { name: 'Close navigation' }));
  expect(document.getElementById('authenticated-links')).toHaveClass('hidden');
  const account = screen.getByRole('button', { name: /Rae/ });
  account.focus();
  await actor.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: 'Logout' })).toBeVisible();
  expect(getSession()).toEqual(session);
  await actor.click(account);
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  await actor.click(account);
  await actor.click(screen.getByRole('button', { name: 'Open navigation' }));
  await actor.click(screen.getByRole('link', { name: 'Write' }));
  expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  expect(getSession()).toEqual(session);
});
it('retains session, route and actionable dropdown when clearSession fails', async () => {
  setSession(session);
  render(<MemoryRouter initialEntries={['/blogs']}><App /></MemoryRouter>);
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: /Rae/ }));
  const denied = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
  await actor.click(screen.getByRole('button', { name: 'Logout' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Logout could not be completed in this browser.');
  expect(getSession()).toEqual(session);
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  denied.mockRestore();
  await actor.click(screen.getByRole('button', { name: 'Logout' }));
  expect(getSession()).toBeNull();
  expect(screen.getByRole('link', { name: 'Get Started', exact: true })).toBeVisible();
});
it('refreshes the App navbar after real login, then explicitly logs out without deleting posts', async () => {
  localStorage.setItem('writespace_users', JSON.stringify([
    { id: 'u', username: 'u', displayName: 'Rae', password: 'demo-only', role: 'user' },
  ]));
  savePosts([{ id: 'p', title: 'Note', content: 'Text', authorId: 'u', authorName: 'Rae', createdAt: '2025-01-01' }]);
  const before = getPosts();
  render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText('Username'), 'u');
  await actor.type(screen.getByLabelText('Password'), 'demo-only');
  await actor.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.getByRole('navigation', { name: 'Authenticated navigation' })).toBeVisible();
  await actor.click(screen.getByRole('button', { name: /Rae/ }));
  expect(getSession()).toEqual(session);
  await actor.click(screen.getByRole('button', { name: 'Logout' }));
  expect(screen.getByRole('navigation', { name: 'Public navigation' })).toBeVisible();
  expect(screen.queryByRole('navigation', { name: 'Authenticated navigation' })).not.toBeInTheDocument();
  expect(getSession()).toBeNull();
  expect(getPosts()).toEqual(before);
});
