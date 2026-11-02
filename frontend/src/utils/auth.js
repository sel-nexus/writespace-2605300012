/** Match unsafe demo credentials and own the local session boundary.
 * Notes:
 *   Client roles are editable by the browser owner, not secure authorization.
 *   Never use real passwords: account passwords are plaintext in localStorage.
 */
import { getUsers } from './storage.js';
const sessionKey = 'writespace_session';
/** Check a session's required identity and role without trusting stored JSON.
 * Args:
 *   session: A candidate local identity.
 * Returns:
 *   Whether all required fields are nonempty strings with a recognized role.
 */
function validSession(session) {
  return (
    session !== null &&
    typeof session === 'object' &&
    !Array.isArray(session) &&
    ['userId', 'username', 'displayName'].every(
      (key) =>
        typeof session[key] === 'string' && session[key].trim().length > 0,
    ) &&
    ['admin', 'user'].includes(session.role)
  );
}
/** Read the local identity, failing closed on inaccessible or malformed sessions.
 * Returns:
 *   A validated session or null for guest access.
 */
export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey));
    return validSession(session) ? session : null;
  } catch {
    return null;
  }
}
/** Persist only a validated identity before navigating.
 * Args:
 *   session: The identity to retain in this browser.
 * Raises:
 *   Invalid session or browser-storage failure; never reports false success.
 */
export function setSession(session) {
  if (!validSession(session)) throw new Error('Invalid session.');
  const { userId, username, displayName, role } = session;
  localStorage.setItem(
    sessionKey,
    JSON.stringify({ userId, username, displayName, role }),
  );
}
/** Remove only the local session on an explicit logout.
 * Raises:
 *   Browser-storage removal errors for the caller to report.
 */
export function clearSession() {
  localStorage.removeItem(sessionKey);
}
/** Match fixed Admin first, then valid local accounts, without changing accounts.
 * Args:
 *   username: The submitted name, compared trimmed and lowercased in en-US.
 *   password: The exact demo password; whitespace and case remain significant.
 * Returns:
 *   A canonical session or null when credentials or stored account shape fail.
 */
export function authenticate(username, password) {
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password
  )
    return null;
  const key = username.trim().toLocaleLowerCase('en-US');
  if (key === 'admin') {
    return password === 'admin'
      ? {
          userId: 'admin',
          username: 'admin',
          displayName: 'Admin',
          role: 'admin',
        }
      : null;
  }
  const account = getUsers().find(
    (user) =>
      user !== null &&
      typeof user === 'object' &&
      typeof user.username === 'string' &&
      user.username.trim().toLocaleLowerCase('en-US') === key &&
      user.password === password &&
      validSession({
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      }),
  );
  if (!account) return null;
  return {
    userId: account.id,
    username: account.username.trim(),
    displayName: account.displayName,
    role: account.role,
  };
}
