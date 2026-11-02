/** Create unsafe browser-local user accounts without changing the session.
 * Notes:
 *   Passwords remain plaintext and untouched; never use real credentials.
 *   Whole-array writes provide no cross-tab transaction or backup.
 */
import { getUsers, saveUsers } from './storage.js';

/** Validate required fields and canonical username uniqueness without writes.
 * Args:
 *   form: Display name, username, exact password and confirmation from the form.
 *   users: The current stored accounts used for collision checks.
 * Returns:
 *   Field-keyed errors, empty when registration may proceed.
 */
export function validateRegistration(form, users) {
  const errors = {};
  const username = form.username.trim();
  if (!form.displayName.trim())
    errors.displayName = 'Display name is required.';
  if (!username) errors.username = 'Username is required.';
  if (!form.password) errors.password = 'Password is required.';
  if (!form.confirmPassword) {
    errors.confirmPassword = 'Confirm password is required.';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  const key = username.toLocaleLowerCase('en-US');
  if (key === 'admin') {
    errors.username = 'This username is reserved.';
  } else if (
    username &&
    users.some(
      (user) =>
        typeof user?.username === 'string' &&
        user.username.trim().toLocaleLowerCase('en-US') === key,
    )
  ) {
    errors.username = 'This username already exists.';
  }
  return errors;
}

/** Persist one validated user account before the caller attempts sign-in.
 * Args:
 *   form: The submitted registration fields; any supplied role is ignored.
 * Returns:
 *   Field errors or the newly saved account.
 * Raises:
 *   Account creation or storage failure; the caller must not save a session.
 */
export function createAccount(form) {
  const users = getUsers();
  const errors = validateRegistration(form, users);
  if (Object.keys(errors).length) return { errors, account: null };
  const account = {
    id: crypto.randomUUID(),
    displayName: form.displayName.trim(),
    username: form.username.trim(),
    password: form.password,
    role: 'user',
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, account]);
  return { errors: {}, account };
}
