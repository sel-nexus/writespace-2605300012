/** Verify public role-home links and library-avatar fallback appearance. */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicNavbar } from './PublicNavbar.jsx';
import { Avatar, getAvatar } from './Avatar.jsx';
import { setSession } from '../utils/auth.js';
/** Mount link destinations so clicks exercise real router navigation. */
function mount() {
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<PublicNavbar />} />
        <Route path="/login" element={<p>Login destination</p>} />
        <Route path="/register" element={<p>Register destination</p>} />
        <Route path="/admin" element={<p>Admin destination</p>} />
        <Route path="/blogs" element={<p>User destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
describe('PublicNavbar', () => {
  it('shows logo and guest links without account controls', () => {
    mount();
    expect(screen.getByRole('link', { name: 'WriteSpace' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();
  });
  it.each([
    ['Login', 'Login destination'],
    ['Get Started', 'Register destination'],
  ])('navigates guest %s action', async (label, destination) => {
    mount();
    await userEvent.setup().click(screen.getByRole('link', { name: label }));
    expect(screen.getByText(destination)).toBeVisible();
  });
  it.each([
    ['admin', '/admin', 'Admin destination'],
    ['user', '/blogs', 'User destination'],
  ])(
    'uses %s role-home action without clearing session',
    async (role, path, destination) => {
      setSession({
        userId: 'u',
        username: 'local',
        displayName: 'Local Reader',
        role,
      });
      mount();
      expect(screen.getByText('Local Reader')).toBeVisible();
      expect(screen.queryByText('Get Started')).not.toBeInTheDocument();
      expect(screen.queryByText('Login')).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Go to Dashboard' }),
      ).toHaveAttribute('href', path);
      await userEvent
        .setup()
        .click(screen.getByRole('link', { name: 'Go to Dashboard' }));
      expect(screen.getByText(destination)).toBeVisible();
      expect(localStorage.getItem('writespace_session')).not.toBeNull();
    },
  );
  it('treats wrong-role stored sessions as guest', () => {
    localStorage.setItem(
      'writespace_session',
      JSON.stringify({
        userId: 'x',
        username: 'x',
        displayName: 'x',
        role: 'owner',
      }),
    );
    mount();
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
  });
});
describe('Avatar', () => {
  it.each([
    ['admin', 'Admin avatar', 'bg-violet-600'],
    ['user', 'User avatar', 'bg-indigo-500'],
    ['unknown', 'User avatar', 'bg-indigo-500'],
  ])('renders SVG for %s', (role, label, color) => {
    const { container } = render(getAvatar(role));
    expect(screen.getByRole('img', { name: label })).toHaveClass(color);
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
  it('defaults to a user library icon', () => {
    render(<Avatar />);
    expect(screen.getByRole('img', { name: 'User avatar' })).toBeVisible();
  });
});
