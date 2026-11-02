/** Own browser-local post/account arrays; reads recover to empty, writes never hide failure.
 * Notes:
 *   Posts contain id, title, content, createdAt, authorId and authorName.
 *   Accounts contain id, displayName, username, plaintext password, role and createdAt.
 *   Whole-array writes offer neither backups nor cross-tab transactions.
 */
/** Read one collection without trusting its serialization or top-level shape.
 * Args:
 *   key: The collection's browser storage name.
 * Returns:
 *   The stored array or an empty array on missing, invalid or inaccessible data.
 */
function readArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
/** Read local posts without reordering or rewriting them. */
export function getPosts() {
  return readArray('writespace_posts');
}
/** Save the complete post collection.
 * Args:
 *   posts: The next complete collection.
 * Raises:
 *   Serialization or browser-storage failures for the caller to report.
 */
export function savePosts(posts) {
  localStorage.setItem('writespace_posts', JSON.stringify(posts));
}
/** Read locally registered accounts, excluding the built-in Admin. */
export function getUsers() {
  return readArray('writespace_users');
}
/** Save demo accounts with unsafe plaintext credentials.
 * Args:
 *   users: The next complete collection.
 * Raises:
 *   Serialization or browser-storage failures for the caller to report.
 */
export function saveUsers(users) {
  localStorage.setItem('writespace_users', JSON.stringify(users));
}
