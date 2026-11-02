/** Verify escaped reading, fresh authorization, confirmation and persisted deletion states. */
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReadBlog from './ReadBlog.jsx';
import Home from './Home.jsx';
import { setSession, clearSession } from '../utils/auth.js';
import { savePosts, getPosts } from '../utils/storage.js';
const post = {
  id: 'p', title: '<b>Plain title</b>', content: '<script>alert(1)</script>\n  indented\n\nlast',
  authorId: 'u', authorName: 'Rae', createdAt: '2025-02-03',
};
const session = { userId: 'u', username: 'u', displayName: 'Rae', role: 'user' };
/** Mount real reader and list views to observe navigation and persisted data. */
function mount(id = 'p') {
  return render(
    <MemoryRouter initialEntries={[`/blog/${id}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/blog/:id" element={<ReadBlog />} />
        <Route path="/blogs" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  );
}
it('renders full escaped whitespace, title, author, date and back link with no read mutation', () => {
  savePosts([post]);
  setSession(session);
  const { container } = mount();
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  const text = container.querySelector('.whitespace-pre-wrap');
  expect(text.textContent).toBe(post.content);
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('b')).toBeNull();
  expect(screen.getByText('Feb 03, 2025')).toBeVisible();
  expect(screen.getByText('Rae')).toBeVisible();
  expect(screen.getByRole('img', { name: 'User avatar' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Back to All Posts' })).toHaveAttribute('href', '/blogs');
  expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/edit/p');
  expect(getPosts()).toEqual([post]);
});
it.each([null, { ...session, userId: 'other' }])('hides edit and delete for denied viewer %#', (viewer) => {
  savePosts([post]);
  if (viewer) setSession(viewer);
  mount();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
});
it.each(['{}', '{bad', '[null, {}, []]'])('renders missing state for malformed collection %s', (raw) => {
  localStorage.setItem('writespace_posts', raw);
  mount();
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it('handles missing ID, unavailable dates and back navigation', async () => {
  savePosts([{ ...post, createdAt: null }]);
  mount('missing');
  expect(screen.getByRole('heading', { name: 'Post not found' })).toBeVisible();
  await userEvent.setup().click(screen.getByRole('link', { name: 'Back to All Posts' }));
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  expect(screen.getByText('Date unavailable')).toBeVisible();
});
it('cancels deletion without changing reader or storage', async () => {
  savePosts([post]);
  setSession(session);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  mount();
  expect(confirm).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  expect(confirm).toHaveBeenCalledWith('Delete this post?');
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(getPosts()).toEqual([post]);
});
it.each(['user', 'admin'])('confirms deletion for %s and navigates only after persistence', async (role) => {
  savePosts([post, { ...post, id: 'other', title: 'Remaining' }]);
  setSession({ ...session, role, userId: role === 'admin' ? 'admin' : 'u' });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mount();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  expect(getPosts()).toEqual([{ ...post, id: 'other', title: 'Remaining' }]);
});
it('reports failed save, retains reader and supports subsequent explicit deletion', async () => {
  savePosts([post]);
  setSession(session);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mount();
  const denied = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  const actor = userEvent.setup();
  await actor.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Post could not be deleted in this browser.');
  expect(screen.getByRole('heading', { name: post.title })).toBeVisible();
  expect(getPosts()).toEqual([post]);
  denied.mockRestore();
  await actor.click(screen.getByRole('button', { name: 'Delete' }));
  expect(getPosts()).toEqual([]);
  expect(screen.getByText('No blogs yet. Be the first to write one!')).toBeVisible();
});
it.each(['session', 'owner'])('rejects stale %s before showing confirmation', async (change) => {
  savePosts([post]);
  setSession(session);
  mount();
  if (change === 'session') clearSession();
  else savePosts([{ ...post, authorId: 'other' }]);
  const before = getPosts();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent('You cannot delete this post.');
  expect(confirm).not.toHaveBeenCalled();
  expect(getPosts()).toEqual(before);
});
it.each(['session', 'owner', 'missing'])('rechecks %s changed during confirmation before any save', async (change) => {
  savePosts([post]);
  setSession(session);
  mount();
  vi.spyOn(window, 'confirm').mockImplementation(() => {
    if (change === 'session') clearSession();
    else savePosts(change === 'missing' ? [] : [{ ...post, authorId: 'other' }]);
    return true;
  });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('alert')).toHaveTextContent(change === 'missing' ? 'Post not found.' : 'You cannot delete this post.');
  expect(getPosts()).toEqual(change === 'missing' ? [] : [{ ...post, authorId: change === 'owner' ? 'other' : 'u' }]);
  expect(screen.queryByRole('heading', { name: 'All Blogs' })).not.toBeInTheDocument();
});
