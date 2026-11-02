/** Verify exact excerpts, accents, safe text and owner-only edit affordances. */
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BlogCard } from './BlogCard.jsx';
import { saveUsers } from '../utils/storage.js';
const post = { id: 'p', title: '<b>Title</b>', content: 'x'.repeat(121), authorId: 'u', authorName: 'Rae', createdAt: '2025-02-03' };
const session = { userId: 'u', username: 'u', displayName: 'Rae', role: 'user' };
/** Mount a preview within native link routing. */
function mount(props = {}) {
  return render(<MemoryRouter><BlogCard post={post} {...props} /></MemoryRouter>);
}
it('renders safe title, exactly 120 characters, date and author with a real reader link', () => {
  const { container } = mount();
  expect(screen.getByText('x'.repeat(120), { exact: true })).toBeVisible();
  expect(screen.queryByText('x'.repeat(121))).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: '<b>Title</b>' })).toHaveAttribute('href', '/blog/p');
  expect(container.querySelector('b')).toBeNull();
  expect(screen.getByText('Feb 03, 2025')).toBeVisible();
  expect(screen.getByText('Rae')).toBeVisible();
  expect(screen.getByRole('img', { name: 'User avatar' })).toBeVisible();
});
it.each([0, 1, 2, 3, 4])('cycles accent for position %s', (index) => {
  mount({ index });
  expect(screen.getByRole('article')).toHaveClass(
    ['border-t-indigo-600', 'border-t-violet-600', 'border-t-pink-500', 'border-t-teal-500'][index % 4],
  );
});
it.each([NaN, -4, 0.5])('uses safe accent for index %s', (index) => {
  mount({ index });
  expect(screen.getByRole('article')).toHaveClass('border-t-indigo-600');
});
it.each([null, {}, { ...session, userId: 'other' }, { ...session, role: 'unknown' }])('hides edit for denied viewer %#', (viewer) => {
  mount({ session: viewer });
  expect(screen.queryByRole('link', { name: /Edit/ })).not.toBeInTheDocument();
});
it.each(['user', 'admin'])('shows Edit to owner or %s', (role) => {
  mount({ session: { ...session, role, userId: role === 'admin' ? 'a' : 'u' } });
  expect(screen.getByRole('link', { name: 'Edit <b>Title</b>' })).toHaveAttribute('href', '/edit/p');
});
it('uses registered Admin author appearance regardless of viewer role and handles invalid dates', () => {
  saveUsers([{ id: 'u', role: 'admin' }]);
  mount({ post: { ...post, content: '<script>text</script>', createdAt: {} } });
  expect(screen.getByRole('img', { name: 'Admin avatar' })).toBeVisible();
  expect(screen.getByText('Date unavailable')).toBeVisible();
  expect(screen.getByText('<script>text</script>')).toBeVisible();
});
it.each([null, {}, { ...post, title: {} }])('omits malformed row %#', (row) => {
  mount({ post: row });
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
