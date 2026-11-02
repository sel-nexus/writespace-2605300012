/** Read escaped, whitespace-preserved writing and explicitly confirm local deletion. */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar.jsx';
import { buttons, ui } from '../components/ui.js';
import { authorRole, canManagePost, deletePost, findPost, formatPostDate } from '../utils/posts.js';
import { getSession } from '../utils/auth.js';

/** Resolve the current route record and expose management only to owner or Admin.
 * Returns:
 *   Full plain text, or not-found copy with a real back link.
 */
export default function ReadBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const post = findPost(id);

  /** Confirm only an explicit click, then recheck fresh identity and fresh record. */
  function remove() {
    setError('');
    if (!canManagePost(getSession(), findPost(id))) {
      setError('You cannot delete this post.');
      return;
    }
    if (!window.confirm('Delete this post?')) return;
    try {
      deletePost(id);
      navigate('/blogs');
    } catch (failure) {
      setError(failure.message === 'You cannot delete this post.' || failure.message === 'Post not found.'
        ? failure.message : 'Post could not be deleted in this browser.');
    }
  }
  return (
    <main className={`${ui.container} py-12`}>
      <Link to="/blogs" className={ui.link}>Back to All Posts</Link>
      {post ? (
        <article className={`${ui.card} mx-auto mt-8 max-w-3xl space-y-6`}>
          <h1 className={`${ui.heading} break-words text-4xl`}>{post.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <Avatar role={authorRole(post)} />
            <span className="break-words">{post.authorName}</span>
            <span>{formatPostDate(post.createdAt)}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{post.content}</p>
          {canManagePost(getSession(), post) && (
            <div className="flex flex-wrap gap-3">
              <Link to={`/edit/${encodeURIComponent(id)}`} className={buttons.secondary}>Edit</Link>
              <button
                type="button"
                onClick={remove}
                className={`${buttons.secondary} border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
              >
                Delete
              </button>
            </div>
          )}
        </article>
      ) : <h1 className={`${ui.heading} mt-8 text-4xl`}>Post not found</h1>}
      {error && <p role="alert" className={`${ui.error} mt-6`}>{error}</p>}
    </main>
  );
}
