/** Verify every local guard branch with native route destinations. */
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import Home from '../pages/Home.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import { setSession } from '../utils/auth.js';
/** Mount a guarded view with real login and blog destinations. */
function mount(adminOnly = false) {
  render(
    <MemoryRouter initialEntries={['/guard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/guard" element={<ProtectedRoute adminOnly={adminOnly}><p>Allowed content</p></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/blogs" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  );
}
it.each([false, true])('redirects guest from guard adminOnly=%s', (adminOnly) => {
  mount(adminOnly);
  expect(screen.getByRole('heading', { name: 'Login' })).toBeVisible();
  expect(screen.queryByText('Allowed content')).not.toBeInTheDocument();
});
it('fails closed for malformed session', () => {
  localStorage.setItem('writespace_session', '{bad');
  mount();
  expect(screen.getByLabelText('Username')).toBeVisible();
});
it.each([['user', false], ['admin', false], ['admin', true]])('permits %s with adminOnly=%s', (role, adminOnly) => {
  setSession({ userId: 'u', username: 'u', displayName: 'Demo', role });
  mount(adminOnly);
  expect(screen.getByText('Allowed content')).toBeVisible();
});
it('redirects ordinary user from Admin-only view to real blogs', () => {
  setSession({ userId: 'u', username: 'u', displayName: 'Demo', role: 'user' });
  mount(true);
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  expect(screen.queryByText('Allowed content')).not.toBeInTheDocument();
});
