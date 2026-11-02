/** Share a controlled create/edit form with fresh identity and persistence checks. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { buttons, demoGuidance, ui } from '../components/ui.js';
import { getSession } from '../utils/auth.js';
import {
  canManagePost,
  createPost,
  findEditablePost,
  updatePost,
  validatePostForm,
} from '../utils/posts.js';

/** Render required text fields and navigate only after explicit save or cancel.
 * Args:
 *   editing: Whether the route edits an existing post instead of creating one.
 * Returns:
 *   An accessible editor, not-found state, or guest/non-owner redirect.
 * Notes:
 *   Render and prefill never write; submitting re-reads session and collection.
 */
export default function WriteBlog({ editing = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const session = getSession();
  const post = editing ? findEditablePost(id) : null;

  useEffect(() => {
    const original = editing ? findEditablePost(id) : null;
    setTitle(original ? original.title : '');
    setContent(original ? original.content : '');
    setErrors({});
    setError('');
  }, [editing, id]);

  /** Validate controlled values, then save once under freshly resolved ownership. */
  function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const fieldErrors = validatePostForm(title, content);
    setErrors(fieldErrors);
    setError('');
    if (Object.keys(fieldErrors).length) return;
    setSubmitting(true);
    try {
      const saved = editing
        ? updatePost(id, title, content)
        : createPost(title, content);
      navigate(`/blog/${encodeURIComponent(saved.id)}`);
    } catch (failure) {
      if (failure.message === 'Sign in again to save your post.') {
        navigate('/login', { replace: true });
      } else if (failure.message === 'You cannot edit this post.') {
        navigate('/blogs', { replace: true });
      } else {
        setError(
          failure.message === 'Post not found.'
            ? failure.message
            : 'Post could not be saved in this browser. Keep your text, check browser storage space or permissions, and try Save again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return <Navigate to="/login" replace />;
  if (editing && post && !canManagePost(session, post))
    return <Navigate to="/blogs" replace />;
  if (editing && !post) {
    return (
      <main className={`${ui.container} py-12`}>
        <Link to="/blogs" className={ui.link}>
          Back to All Posts
        </Link>
        <h1 className={`${ui.heading} mt-8 text-4xl`}>Post not found</h1>
      </main>
    );
  }

  return (
    <main className={`${ui.container} py-12`}>
      <section className={`${ui.card} mx-auto max-w-3xl space-y-6`}>
        <h1 className={`${ui.heading} text-4xl`}>
          {editing ? 'Edit Post' : 'Write a Post'}
        </h1>
        <p className={ui.guidance}>{demoGuidance}</p>
        <form
          noValidate
          onSubmit={submit}
          className="space-y-6"
          aria-busy={submitting}
        >
          <div className="space-y-2">
            <label htmlFor="title" className="block font-medium">
              Title
            </label>
            <input
              id="title"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'title-error' : undefined}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={ui.field}
            />
            {errors.title && (
              <p id="title-error" role="alert" className={ui.error}>
                {errors.title}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="content" className="block font-medium">
              Content
            </label>
            <textarea
              id="content"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.content)}
              aria-describedby={
                errors.content ? 'content-error content-count' : 'content-count'
              }
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className={`${ui.field} min-h-64 resize-y leading-relaxed`}
            />
            <p
              id="content-count"
              className="text-sm tabular-nums text-slate-600"
              aria-live="polite"
            >
              {content.length} characters
            </p>
            {errors.content && (
              <p id="content-error" role="alert" className={ui.error}>
                {errors.content}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className={ui.error}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className={buttons.primary}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <Link
              to={editing ? `/blog/${encodeURIComponent(id)}` : '/blogs'}
              className={buttons.secondary}
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
WriteBlog.propTypes = { editing: PropTypes.bool };
