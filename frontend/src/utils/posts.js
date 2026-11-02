/** Read plain-text posts safely and mutate only freshly authorized local records.
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
  return (
    post !== null &&
    typeof post === 'object' &&
    !Array.isArray(post) &&
    ['id', 'title', 'content', 'authorId', 'authorName'].every(
      (key) => typeof post[key] === 'string' && post[key].trim().length > 0,
    )
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
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
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
  return (
    isPost(post) &&
    session !== null &&
    typeof session === 'object' &&
    !Array.isArray(session) &&
    ['userId', 'username', 'displayName'].every(
      (key) =>
        typeof session[key] === 'string' && session[key].trim().length > 0,
    ) &&
    (session.role === 'admin' ||
      (session.role === 'user' && session.userId === post.authorId))
  );
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
  const account = getUsers().find(
    (row) =>
      row !== null &&
      typeof row === 'object' &&
      !Array.isArray(row) &&
      row.id === post.authorId,
  );
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
  const matches = rows.filter(
    (row) => row !== null && typeof row === 'object' && row.id === id,
  );
  if (matches.length !== 1 || !isPost(matches[0]))
    throw new Error('Post not found.');
  if (!canManagePost(getSession(), matches[0]))
    throw new Error('You cannot delete this post.');
  savePosts(rows.filter((row) => row !== matches[0]));
}

/** Validate required text without normalizing content or imposing a limit.
 * Args:
 *   title: The proposed heading, trimmed only when saved.
 *   content: The original plain text, including whitespace.
 * Returns:
 *   Associated field errors, or an empty object for valid input.
 */
export function validatePostForm(title, content) {
  const errors = {};
  if (typeof title !== 'string' || !title.trim())
    errors.title = 'Title is required.';
  if (typeof content !== 'string' || !content.trim())
    errors.content = 'Content is required.';
  return errors;
}

/** Resolve exactly one readable target, counting corrupt rows in ambiguity checks.
 * Args:
 *   rows: The current unfiltered collection.
 *   id: The requested nonempty post identity.
 * Returns:
 *   A single valid record or null; never selects an arbitrary duplicate.
 */
function uniquePost(rows, id) {
  if (typeof id !== 'string' || !id.trim()) return null;
  const matches = rows.filter(
    (row) => row !== null && typeof row === 'object' && row.id === id,
  );
  return matches.length === 1 && isPost(matches[0]) ? matches[0] : null;
}

/** Read an unambiguous edit target without rewriting stored rows.
 * Args:
 *   id: The editor route identity.
 * Returns:
 *   A fresh valid post or null for missing, corrupt or duplicate rows.
 */
export function findEditablePost(id) {
  return uniquePost(getPosts(), id);
}

/** Reject invalid form values before persistence or identity generation.
 * Args:
 *   title: The proposed heading.
 *   content: The proposed plain text.
 * Raises:
 *   The first required-field error when validation fails.
 */
function requirePostForm(title, content) {
  const errors = validatePostForm(title, content);
  if (errors.title || errors.content)
    throw new Error(errors.title || errors.content);
}

/** Append a post using only the fresh validated local session as its author.
 * Args:
 *   title: The heading to trim for storage.
 *   content: Plain text retained exactly as entered.
 * Returns:
 *   The persisted post after a successful whole-array write.
 * Raises:
 *   Invalid fields, absent session, identity generation or persistence failures.
 */
export function createPost(title, content) {
  requirePostForm(title, content);
  const session = getSession();
  if (!session) throw new Error('Sign in again to save your post.');
  const rows = getPosts();
  const post = {
    id: crypto.randomUUID(),
    title: title.trim(),
    content,
    createdAt: new Date().toISOString(),
    authorId: session.userId,
    authorName: session.displayName,
  };
  savePosts([...rows, post]);
  return post;
}

/** Replace one fresh authorized target while retaining identity and metadata.
 * Args:
 *   id: The explicit edit target.
 *   title: The heading to trim for storage.
 *   content: Plain text retained exactly as entered.
 * Returns:
 *   The persisted replacement record.
 * Raises:
 *   Invalid fields, absent session, missing/ambiguous target, denied ownership or write failure.
 * Notes:
 *   Unrelated and malformed rows remain untouched; no cached identity is trusted.
 */
export function updatePost(id, title, content) {
  requirePostForm(title, content);
  const session = getSession();
  if (!session) throw new Error('Sign in again to save your post.');
  const rows = getPosts();
  const original = uniquePost(rows, id);
  if (!original) throw new Error('Post not found.');
  if (!canManagePost(session, original))
    throw new Error('You cannot edit this post.');
  const post = { ...original, title: title.trim(), content };
  savePosts(rows.map((row) => (row === original ? post : row)));
  return post;
}
