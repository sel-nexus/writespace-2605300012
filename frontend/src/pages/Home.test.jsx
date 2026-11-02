/** Verify collection ordering, responsive structure and safe empty fallbacks. */
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home.jsx';
import { savePosts, getPosts } from '../utils/storage.js';
import { setSession } from '../utils/auth.js';
/** Mount the real list without replacing its storage helpers. */
function mount() { return render(<MemoryRouter><Home /></MemoryRouter>); }
it.each(['user', 'admin'])('shows exact empty copy and Write CTA to %s', (role) => {
  setSession({ userId: 'u', username: 'u', displayName: 'Rae', role });
  mount();
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
});
it.each(['{bad', '{}', 'null', '[null, {}, [], {"title":{}}]'])('handles malformed store %s without changing it', (raw) => {
  localStorage.setItem('writespace_posts', raw);
  mount();
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it('handles unavailable storage reads', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  mount();
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
});
it('renders sorted cards in the required grid without a read mutation', () => {
  const base = { id: 'old', title: 'Old', content: 'Text', authorId: 'u', authorName: 'Rae', createdAt: '2020-01-01' };
  const rows = [base, null, { ...base, id: 'invalid', title: 'Invalid', createdAt: 'bad' },
    { ...base, id: 'new', title: 'New', createdAt: '2025-01-01' }];
  savePosts(rows);
  const { container } = mount();
  expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual(['New', 'Old', 'Invalid']);
  expect(container.querySelector('.grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3');
  expect(getPosts()).toEqual(rows);
});
