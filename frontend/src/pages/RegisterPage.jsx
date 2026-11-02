/** Register only unsafe browser-local users and explain partial sign-in failures. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BookOpen } from '@phosphor-icons/react';
import { createAccount } from '../utils/accounts.js';
import { getSession, setSession } from '../utils/auth.js';
import { buttons, ui, demoGuidance } from '../components/ui.js';

const fields = [
  {
    name: 'displayName',
    label: 'Display name',
    type: 'text',
    autoComplete: 'nickname',
  },
  {
    name: 'username',
    label: 'Username',
    type: 'text',
    autoComplete: 'username',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    autoComplete: 'new-password',
  },
  {
    name: 'confirmPassword',
    label: 'Confirm password',
    type: 'password',
    autoComplete: 'new-password',
  },
];

/** Render a labelled required input with its associated validation error.
 * Args:
 *   field: The native input identity and semantics.
 *   value: The entered text, never normalized while typing.
 *   error: The validation feedback for this field.
 *   onChange: The explicit input change handler.
 */
function RegistrationField({ field, value, error, onChange }) {
  return (
    <div>
      <label htmlFor={field.name} className="mb-2 block font-medium">
        {field.label}
      </label>
      <input
        id={field.name}
        name={field.name}
        type={field.type}
        autoComplete={field.autoComplete}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${field.name}-error` : undefined}
        className={ui.field}
        value={value}
        onChange={onChange}
      />
      {error && (
        <p
          id={`${field.name}-error`}
          role="alert"
          className={`${ui.error} mt-2`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
RegistrationField.propTypes = {
  field: PropTypes.shape({
    name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    autoComplete: PropTypes.string.isRequired,
  }).isRequired,
  value: PropTypes.string.isRequired,
  error: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

/** Save the account then its session only on explicit valid submission. */
export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const session = getSession();

  /** Handle registration without inventing a rollback across storage keys.
   * Args:
   *   event: The native submit event to prevent.
   * Notes:
   *   An account-write failure never attempts sign-in. A session-write failure
   *   leaves the saved account intact and directs the visitor to Login.
   */
  function submit(event) {
    event.preventDefault();
    setMessage('');
    setErrors({});
    let result;
    try {
      result = createAccount(form);
    } catch {
      setMessage(
        'Account could not be saved in this browser. Check local storage availability and try again.',
      );
      return;
    }
    setErrors(result.errors);
    if (!result.account) return;
    const account = result.account;
    try {
      setSession({
        userId: account.id,
        username: account.username,
        displayName: account.displayName,
        role: account.role,
      });
    } catch {
      setMessage(
        'Your account exists in this browser, but sign-in did not complete. Check local storage availability, then use Login.',
      );
      return;
    }
    navigate('/blogs', { replace: true });
  }

  if (session) {
    return (
      <Navigate to={session.role === 'admin' ? '/admin' : '/blogs'} replace />
    );
  }
  return (
    <main className={`${ui.page} flex items-center justify-center px-4 py-12`}>
      <div className={`${ui.card} w-full max-w-md shadow-lg`}>
        <Link
          to="/"
          className={`${ui.link} flex items-center gap-2 text-xl font-bold`}
        >
          <BookOpen size={24} weight="bold" aria-hidden="true" />
          <span>WriteSpace</span>
        </Link>
        <h1 className={`${ui.heading} mt-8 text-3xl`}>Register</h1>
        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          {fields.map((field) => (
            <RegistrationField
              key={field.name}
              field={field}
              value={form[field.name]}
              error={errors[field.name]}
              onChange={(event) =>
                setForm({ ...form, [field.name]: event.target.value })
              }
            />
          ))}
          {message && (
            <p role="alert" className={ui.error}>
              {message}
            </p>
          )}
          <button type="submit" className={`${buttons.primary} w-full`}>
            Register
          </button>
        </form>
        <p className="mt-6 text-sm">
          <Link to="/login" className={ui.link}>
            Login
          </Link>
        </p>
        <aside
          aria-label="Local demo guidance"
          className="mt-8 border-t border-slate-200 pt-5"
        >
          <p className={ui.guidance}>{demoGuidance}</p>
        </aside>
      </div>
    </main>
  );
}
