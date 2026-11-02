/** Manage unsafe browser-local accounts through explicit, freshly authorized actions. */
import { useState } from "react";
import { UserRow } from "../components/UserRow.jsx";
import { buttons, demoGuidance, ui } from "../components/ui.js";
import {
  createAdminAccount,
  deletableAccount,
  deleteAdminAccount,
  managedAccounts,
} from "../utils/accounts.js";
import { getSession } from "../utils/auth.js";

const initialForm = {
  displayName: "",
  username: "",
  password: "",
  role: "user",
};
const fixedAdmin = {
  id: "admin",
  username: "admin",
  displayName: "Admin",
  role: "admin",
};
const fields = [
  ["displayName", "Display name", "text", "nickname"],
  ["username", "Username", "text", "username"],
  ["password", "Password", "password", "new-password"],
  ["role", "Role"],
];
const accessError =
  "Admin access is required. Sign in as an Admin and try again.";

/** Render the account creation form and responsive account list.
 * Returns:
 *   Labelled form, desktop table and mobile cards; reads never persist fixed Admin.
 */
export default function UserManagement() {
  const [accounts, setAccounts] = useState(managedAccounts);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const session = getSession();
  const allowed = session?.role === "admin";
  const rows = [fixedAdmin, ...accounts];

  /** Save a validated account and refresh only after successful persistence.
   * Args:
   *   event: The explicit native submit event.
   */
  function submit(event) {
    event.preventDefault();
    setErrors({});
    setError("");
    setStatus("");
    setSaving(true);
    try {
      const result = createAdminAccount(form);
      setErrors(result.errors);
      if (result.account) {
        setAccounts(managedAccounts());
        setStatus(`Account created: ${result.account.displayName}.`);
        setForm(initialForm);
      }
    } catch (failure) {
      setError(
        failure?.message === accessError
          ? accessError
          : "Account could not be saved in this browser. Check local storage availability and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  /** Confirm an explicit delete and repeat checks after the blocking dialog.
   * Args:
   *   id: The selected account identity, never a cached target record.
   */
  function remove(id) {
    setError("");
    setStatus("");
    try {
      const target = deletableAccount(id);
      if (!window.confirm(`Delete account ${target.username.trim()}?`)) return;
      deleteAdminAccount(id, true);
      setAccounts(managedAccounts());
      setStatus("Account deleted.");
    } catch (failure) {
      const known = [
        accessError,
        "Default admin cannot be deleted.",
        "You cannot delete your current account.",
        "Account not found. Refresh the page and try again.",
        "Account not found or ambiguous. Refresh the page and try again.",
      ];
      setError(
        known.includes(failure?.message)
          ? failure.message
          : "Account could not be deleted in this browser. Check local storage availability and try again.",
      );
    }
  }

  return (
    <main className={`${ui.container} space-y-8 py-12`}>
      <header>
        <p className="text-sm font-medium uppercase tracking-widest text-violet-700">
          Administration
        </p>
        <h1 className={`${ui.heading} mt-2 text-4xl`}>Manage Users</h1>
      </header>
      <section aria-labelledby="create-user" className={ui.card}>
        <h2 id="create-user" className={`${ui.heading} text-2xl`}>
          Create User
        </h2>
        <form
          onSubmit={submit}
          noValidate
          className="mt-6 grid gap-5 sm:grid-cols-2"
        >
          {fields.map(([name, label, type, autoComplete]) => {
            const common = {
              id: `account-${name}`,
              name,
              required: true,
              "aria-required": true,
              "aria-invalid": Boolean(errors[name]),
              "aria-describedby": errors[name]
                ? `account-${name}-error`
                : undefined,
              value: form[name],
              onChange: (event) =>
                setForm({ ...form, [name]: event.target.value }),
              className: ui.field,
            };
            return (
              <div key={name}>
                <label
                  htmlFor={`account-${name}`}
                  className="mb-2 block font-medium"
                >
                  {label}
                </label>
                {name === "role" ? (
                  <select {...common}>
                    <option value="">Select role</option>
                    <option value="user">user</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <input {...common} type={type} autoComplete={autoComplete} />
                )}
                {errors[name] && (
                  <p
                    id={`account-${name}-error`}
                    role="alert"
                    className={`${ui.error} mt-2`}
                  >
                    {errors[name]}
                  </p>
                )}
              </div>
            );
          })}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || !allowed}
              className={buttons.primary}
            >
              {saving ? "Saving…" : "Create User"}
            </button>
          </div>
        </form>
      </section>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      {status && (
        <p role="status" className={ui.guidance}>
          {status}
        </p>
      )}
      <section aria-labelledby="accounts-title" className="space-y-4">
        <h2 id="accounts-title" className={`${ui.heading} text-2xl`}>
          Accounts
        </h2>
        {!accounts.length && (
          <p className={ui.guidance}>
            No registered accounts yet. Create one above.
          </p>
        )}
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block">
          <table
            aria-label="Accounts table"
            className="w-full table-fixed text-left"
          >
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {["Account", "Role", "Created", "Actions"].map((label) => (
                  <th key={label} scope="col" className="p-4 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((account, index) => (
                <UserRow
                  key={`${account.id}-${index}`}
                  account={account}
                  currentUserId={session?.userId}
                  adminAccess={allowed}
                  onDelete={remove}
                />
              ))}
            </tbody>
          </table>
        </div>
        <ul aria-label="Account cards" className="space-y-4 sm:hidden">
          {rows.map((account, index) => (
            <UserRow
              key={`${account.id}-${index}`}
              account={account}
              currentUserId={session?.userId}
              adminAccess={allowed}
              onDelete={remove}
              mobile
            />
          ))}
        </ul>
      </section>
      <p className={ui.guidance}>{demoGuidance}</p>
    </main>
  );
}
