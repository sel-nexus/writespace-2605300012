/** Present a plain-text preview with author appearance and permitted edit navigation. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { PencilSimple } from '@phosphor-icons/react';
import { Avatar } from './Avatar.jsx';
import { ui } from './ui.js';
import { authorRole, canManagePost, formatPostDate, isPost } from '../utils/posts.js';

const accents = ['border-t-indigo-600', 'border-t-violet-600', 'border-t-pink-500', 'border-t-teal-500'];
/** Render a readable record, omitting malformed props rather than injecting them.
 * Args:
 *   post: The local plain-text record.
 *   index: Its sorted position for the repeating accent.
 *   session: The current viewer used only for control visibility.
 * Returns:
 *   A preview article or null for an unusable record.
 */
export function BlogCard({ post, index = 0, session = null }) {
  if (!isPost(post)) return null;
  const accent = accents[((Number.isInteger(index) ? index : 0) % 4 + 4) % 4];
  return (
    <article className={`${ui.card} ${accent} flex min-w-0 flex-col gap-4 border-t-4`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className={`${ui.heading} break-words text-2xl`}>
          <Link to={`/blog/${encodeURIComponent(post.id)}`} className={ui.link}>{post.title}</Link>
        </h2>
        {canManagePost(session, post) && (
          <Link to={`/edit/${encodeURIComponent(post.id)}`} aria-label={`Edit ${post.title}`} className={`${ui.link} p-2`}>
            <PencilSimple size={20} aria-hidden="true" />
          </Link>
        )}
      </div>
      <p className="break-words leading-relaxed text-slate-600">{post.content.slice(0, 120)}</p>
      <div className="mt-auto flex items-center gap-2 text-sm text-slate-500">
        <Avatar role={authorRole(post)} />
        <span className="min-w-0 break-words">{post.authorName}</span>
      </div>
      <p className="text-sm text-slate-500">{formatPostDate(post.createdAt)}</p>
    </article>
  );
}
BlogCard.propTypes = { post: PropTypes.object, index: PropTypes.number, session: PropTypes.object };
