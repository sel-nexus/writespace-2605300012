/** Read plain-text posts safely and delete only freshly authorized local records.
 * Notes:
 *   Posts retain id, title, content, createdAt, authorId and authorName only.
 *   Client ownership is demo UX, not security; whole-array writes can conflict across tabs.
 */
import { getPosts, getUsers, savePosts } from './storage.js';
import { getSession } from './auth.js';

/** Check renderable fields while allowing unavailable dates.
 * Args:
 *   post: An untrusted stored row.
 * Returns:
 *   Whether identity and plain-text fields can be rendered safely.
 */
export function isPost(post) {
  return post !== null && typeof post === 'object' && !Array.isArray(post) &&
    ['id', 'title', 'content', 'authorId', 'authorName'].every(
      (key) => typeof post[key] === 'string' && post[key].trim().length > 0,
    );
}

/** Parse a stored date without coercing non-text values into invented dates.
 * Args:
 *   value: The stored creation timestamp.
 * Returns:
 *   Epoch milliseconds or null when unavailable.
 */
export function postTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Filter malformed rows and sort a copy newest first, with unavailable dates last.
 * Args:
 *   rows: An untrusted collection, defaulting to freshly read storage.
 * Returns:
 *   Valid rows in stable descending order without writes or input mutation.
 */
export function orderedPosts(rows = getPosts()) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isPost).sort((left, right) => {
    const a = postTimestamp(left.createdAt);
    const b = postTimestamp(right.createdAt);
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
  });
}

/** Format a creation date consistently without fabricating unavailable metadata.
 * Args:
 *   value: The stored timestamp.
 * Returns:
 *   An English month, padded day and year, or neutral unavailable copy.
 */
export function formatPostDate(value) {
  const timestamp = postTimestamp(value);
  if (timestamp === null) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(timestamp);
}

/** Resolve a readable post from the current storage snapshot.
 * Args:
 *   id: The route's post identity.
 * Returns:
 *   A valid matching row or null.
 */
export function findPost(id) {
  return getPosts().find((post) => isPost(post) && post.id === id) || null;
}

/** Permit only recognized sessions owning a post or carrying the Admin role.
 * Args:
 *   session: The viewer identity.
 *   post: The candidate record.
 * Returns:
 *   Whether management controls are appropriate.
 */
export function canManagePost(session, post) {
  return isPost(post) && session !== null && typeof session === 'object' &&
    !Array.isArray(session) &&
    ['userId', 'username', 'displayName'].every(
      (key) => typeof session[key] === 'string' && session[key].trim().length > 0,
    ) && (session.role === 'admin' ||
      (session.role === 'user' && session.userId === post.authorId));
}

/** Resolve author appearance from account identity without adding a post role field.
 * Args:
 *   post: The displayed post.
 * Returns:
 *   Admin for the built-in identity or an existing Admin account; otherwise user.
 */
export function authorRole(post) {
  if (!isPost(post)) return 'user';
  if (post.authorId === 'admin') return 'admin';
  const account = getUsers().find((row) => row !== null && typeof row === 'object' &&
    !Array.isArray(row) && row.id === post.authorId);
  return account?.role === 'admin' ? 'admin' : 'user';
}

/** Delete a single freshly resolved post only under the current local session.
 * Args:
 *   id: The explicitly confirmed target identity.
 * Raises:
 *   Missing, ambiguous or unauthorized targets and persistence failures.
 * Notes:
 *   The caller owns explicit confirmation; unrelated and malformed rows are preserved.
 */
export function deletePost(id) {
  const rows = getPosts();
  const matches = rows.filter((row) => row !== null && typeof row === 'object' && row.id === id);
  if (matches.length !== 1 || !isPost(matches[0])) throw new Error('Post not found.');
  if (!canManagePost(getSession(), matches[0])) throw new Error('You cannot delete this post.');
  savePosts(rows.filter((row) => row !== matches[0]));
}
