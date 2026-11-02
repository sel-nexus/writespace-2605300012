/** Create unsafe browser-local user accounts without changing the session.
 * Notes:
 *   Passwords remain plaintext and untouched; never use real credentials.
 *   Whole-array writes provide no cross-tab transaction or backup.
 */
import { getUsers, saveUsers } from "./storage.js";
import { getSession } from "./auth.js";

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
    errors.displayName = "Display name is required.";
  if (!username) errors.username = "Username is required.";
  if (!form.password) errors.password = "Password is required.";
  if (!form.confirmPassword) {
    errors.confirmPassword = "Confirm password is required.";
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  const key = username.toLocaleLowerCase("en-US");
  if (key === "admin") {
    errors.username = "This username is reserved.";
  } else if (
    username &&
    users.some(
      (user) =>
        typeof user?.username === "string" &&
        user.username.trim().toLocaleLowerCase("en-US") === key,
    )
  ) {
    errors.username = "This username already exists.";
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
    role: "user",
    createdAt: new Date().toISOString(),
  };
  saveUsers([...users, account]);
  return { errors: {}, account };
}

/** Recognize displayable local accounts without coercing malformed rows.
 * Args:
 *   row: An untrusted stored account.
 * Returns:
 *   Whether required identity, password and role fields are valid; dates may be unavailable.
 */
export function isManagedAccount(row) {
  return (
    row !== null &&
    typeof row === "object" &&
    !Array.isArray(row) &&
    ["id", "displayName", "username"].every(
      (key) => typeof row[key] === "string" && row[key].trim(),
    ) &&
    typeof row.password === "string" &&
    row.password.length > 0 &&
    ["admin", "user"].includes(row.role)
  );
}

/** Identify the fixed identity even in a legacy or corrupt stored row.
 * Args:
 *   row: The candidate identity.
 * Returns:
 *   Whether its id or canonical username identifies the built-in Admin.
 */
export function isDefaultAdmin(row) {
  return (
    row?.id === "admin" ||
    (typeof row?.username === "string" &&
      row.username.trim().toLocaleLowerCase("en-US") === "admin")
  );
}

/** Read valid display rows without persisting the synthetic built-in account.
 * Returns:
 *   Fresh displayable accounts; malformed and fixed-identity storage rows remain untouched.
 */
export function managedAccounts() {
  return getUsers().filter(
    (row) => isManagedAccount(row) && !isDefaultAdmin(row),
  );
}

/** Require the fresh local Admin role before any account action.
 * Returns:
 *   The current validated Admin session.
 * Raises:
 *   Actionable access error when the session has changed or expired.
 */
function requireAdmin() {
  const session = getSession();
  if (session?.role !== "admin")
    throw new Error(
      "Admin access is required. Sign in as an Admin and try again.",
    );
  return session;
}

/** Validate Admin form types, required fields and canonical uniqueness without writes.
 * Args:
 *   form: Proposed display name, username, untouched password and selected role.
 *   users: Current unfiltered storage rows.
 * Returns:
 *   Field-associated errors, empty only for valid input.
 */
export function validateAdminAccount(form, users = []) {
  const input =
    form && typeof form === "object" && !Array.isArray(form) ? form : {};
  const errors = {};
  const username =
    typeof input.username === "string" ? input.username.trim() : "";
  if (typeof input.displayName !== "string" || !input.displayName.trim())
    errors.displayName = "Display name is required.";
  if (!username) errors.username = "Username is required.";
  if (typeof input.password !== "string" || !input.password)
    errors.password = "Password is required.";
  if (!["user", "admin"].includes(input.role))
    errors.role = "Select user or Admin.";
  const key = username.toLocaleLowerCase("en-US");
  if (key === "admin") errors.username = "This username is reserved.";
  else if (
    username &&
    Array.isArray(users) &&
    users.some(
      (row) =>
        typeof row?.username === "string" &&
        row.username.trim().toLocaleLowerCase("en-US") === key,
    )
  )
    errors.username = "This username already exists.";
  return errors;
}

/** Append one Admin-created account while retaining the current session and all other rows.
 * Args:
 *   form: The validated-by-helper account proposal; extra fields are never saved.
 * Returns:
 *   Field errors or the saved UUID/timestamp account.
 * Raises:
 *   Missing Admin access, identity generation or storage failure.
 */
export function createAdminAccount(form) {
  requireAdmin();
  const rows = getUsers();
  const errors = validateAdminAccount(form, rows);
  if (Object.keys(errors).length) return { errors, account: null };
  const account = {
    id: crypto.randomUUID(),
    displayName: form.displayName.trim(),
    username: form.username.trim(),
    password: form.password,
    role: form.role,
    createdAt: new Date().toISOString(),
  };
  saveUsers([...rows, account]);
  return { errors: {}, account };
}

/** Resolve one deletable target under fresh Admin and self/fixed identity checks.
 * Args:
 *   id: The explicit target identity.
 * Returns:
 *   The unfiltered snapshot and single valid target.
 * Raises:
 *   Fixed/self, access, missing, malformed or ambiguous target errors.
 */
function deletionTarget(id) {
  const session = requireAdmin();
  if (id === "admin") throw new Error("Default admin cannot be deleted.");
  if (id === session.userId)
    throw new Error("You cannot delete your current account.");
  if (typeof id !== "string" || !id.trim())
    throw new Error("Account not found. Refresh the page and try again.");
  const rows = getUsers();
  const matches = rows.filter(
    (row) => row !== null && typeof row === "object" && row.id === id,
  );
  if (matches.some(isDefaultAdmin))
    throw new Error("Default admin cannot be deleted.");
  if (matches.length !== 1 || !isManagedAccount(matches[0]))
    throw new Error(
      "Account not found or ambiguous. Refresh the page and try again.",
    );
  return { rows, target: matches[0] };
}

/** Check a target before opening a confirmation dialog without writing.
 * Args:
 *   id: The selected account identity.
 * Returns:
 *   The fresh deletable record.
 * Raises:
 *   The same permission and identity errors as deletion.
 */
export function deletableAccount(id) {
  return deletionTarget(id).target;
}

/** Delete exactly one account only after explicit confirmation and fresh checks.
 * Args:
 *   id: The selected identity.
 *   confirmed: True only after the native dialog was accepted.
 * Returns:
 *   Whether an account was persisted as deleted; cancellation never writes.
 * Raises:
 *   Permission, protected identity, target or persistence failures.
 */
export function deleteAdminAccount(id, confirmed = false) {
  const { rows, target } = deletionTarget(id);
  if (confirmed !== true) return false;
  saveUsers(rows.filter((row) => row !== target));
  return true;
}
