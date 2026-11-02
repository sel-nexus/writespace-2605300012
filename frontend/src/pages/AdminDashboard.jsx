/** Summarize browser-local records and manage any post through fresh Admin checks. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard.jsx';
import { buttons, demoGuidance, ui } from '../components/ui.js';
import { getSession } from '../utils/auth.js';
import { managedAccounts } from '../utils/accounts.js';
import {
  canManagePost,
  deletePost,
  findEditablePost,
  formatPostDate,
  orderedPosts,
} from '../utils/posts.js';

/** Render three settled metrics, latest five posts and explicit quick actions.
 * Returns:
 *   A guarded Admin overview; mutations retain this route on cancellation or failure.
 * Notes:
 *   Reads never write; delete and edit recheck fresh records and Admin identity.
 */
export default function AdminDashboard() {
  const [posts, setPosts] = useState(orderedPosts);
  const [error, setError] = useState('');
  const accounts = managedAccounts();
  const session = getSession();
  const allowed = session?.role === 'admin';

  /** Reject stale roles or missing/ambiguous records before action or navigation.
   * Args:
   *   id: The explicitly selected post identity.
   * Returns:
   *   Whether this action may proceed under the fresh Admin session.
   */
  function authorize(id) {
    const current = getSession();
    const post = findEditablePost(id);
    if (current?.role !== 'admin' || !canManagePost(current, post)) {
      setError(
        post ? 'Admin access is required to manage posts.' : 'Post not found.',
      );
      return false;
    }
    return true;
  }

  /** Preserve native link behavior while rejecting stale edit permissions.
   * Args:
   *   event: The explicit link activation.
   *   id: The post to resolve again before navigating.
   */
  function edit(event, id) {
    setError('');
    if (!authorize(id)) event.preventDefault();
  }

  /** Confirm an explicit delete and recheck Admin identity after the dialog.
   * Args:
   *   id: The selected local post identity.
   * Notes:
   *   Cancel never writes; quota, missing and permission failures remain inline.
   */
  function remove(id) {
    setError('');
    if (!authorize(id)) return;
    if (!window.confirm('Delete this post?')) return;
    try {
      if (getSession()?.role !== 'admin')
        throw new Error('Admin access is required to manage posts.');
      deletePost(id);
      setPosts(orderedPosts());
    } catch (failure) {
      const known = [
        'Post not found.',
        'You cannot delete this post.',
        'Admin access is required to manage posts.',
      ];
      setError(
        known.includes(failure?.message)
          ? failure.message
          : 'Post could not be deleted in this browser.',
      );
    }
  }

  return (
    <main className={`${ui.container} space-y-8 py-12`}>
      <header className="rounded-2xl bg-violet-700 p-6 text-white sm:p-8">
        <p className="text-sm font-medium uppercase tracking-widest">
          Administration
        </p>
        <h1 className={`${ui.heading} mt-2 text-4xl`}>Admin Dashboard</h1>
        <p className="mt-3 max-w-2xl text-violet-100">
          An overview of the writing and accounts stored in this browser.
        </p>
      </header>
      <dl
        aria-label="Overview statistics"
        className="grid gap-4 sm:grid-cols-3"
      >
        <StatCard label="Total Posts" value={posts.length} />
        <StatCard
          label="Total Users"
          value={accounts.length}
          variant="indigo"
        />
        <StatCard
          label="Total Admins"
          value={accounts.filter((row) => row.role === 'admin').length + 1}
          variant="violet"
        />
      </dl>
      <section
        aria-labelledby="quick-actions"
        className={`${ui.card} space-y-4`}
      >
        <h2 id="quick-actions" className={`${ui.heading} text-2xl`}>
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/write" className={buttons.primary}>
            Write New Post
          </Link>
          <Link to="/users" className={buttons.secondary}>
            Manage Users
          </Link>
        </div>
      </section>
      <section
        aria-labelledby="recent-posts"
        className={`${ui.card} space-y-4`}
      >
        <h2 id="recent-posts" className={`${ui.heading} text-2xl`}>
          Recent Posts
        </h2>
        {error && (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        )}
        {posts.length ? (
          <ul className="divide-y divide-slate-200">
            {posts.slice(0, 5).map((post, index) => (
              <li
                key={`${post.id}-${index}`}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    to={`/blog/${encodeURIComponent(post.id)}`}
                    className={`${ui.link} break-words font-semibold`}
                  >
                    {post.title}
                  </Link>
                  <p className="break-words text-sm text-slate-600">
                    {post.authorName} · {formatPostDate(post.createdAt)}
                  </p>
                </div>
                {allowed && canManagePost(session, post) && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      to={`/edit/${encodeURIComponent(post.id)}`}
                      aria-label={`Edit ${post.title}`}
                      onClick={(event) => edit(event, post.id)}
                      className={buttons.secondary}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete ${post.title}`}
                      onClick={() => remove(post.id)}
                      className={buttons.ghost}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={ui.guidance}>No posts yet.</p>
        )}
      </section>
      <p className={ui.guidance}>{demoGuidance}</p>
    </main>
  );
}
