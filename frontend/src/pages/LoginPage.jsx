/** Sign in only to unsafe browser-local demo accounts. */
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BookOpen } from '@phosphor-icons/react';
import { authenticate, getSession, setSession } from '../utils/auth.js';
import { buttons, ui, demoGuidance } from '../components/ui.js';
/** Validate required native fields and save the local identity before navigation. */
export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const session = getSession();
  /** Handle an explicit login submission without trimming the demo password.
   * Args:
   *   event: The native form submission to prevent.
   * Notes:
   *   Failed writes keep the form actionable and never navigate as success.
   */
  function submit(event) {
    event.preventDefault();
    const fieldErrors = {};
    if (!username.trim()) fieldErrors.username = 'Username is required.';
    if (!password) fieldErrors.password = 'Password is required.';
    setErrors(fieldErrors);
    setMessage('');
    if (Object.keys(fieldErrors).length) return;
    const identity = authenticate(username.trim(), password);
    if (!identity) {
      setMessage('Invalid username or password.');
      return;
    }
    try {
      setSession(identity);
      navigate(identity.role === 'admin' ? '/admin' : '/blogs', {
        replace: true,
      });
    } catch {
      setMessage(
        'Sign-in could not be saved in this browser. Check local storage availability and try again.',
      );
    }
  }
  if (session)
    return (
      <Navigate to={session.role === 'admin' ? '/admin' : '/blogs'} replace />
    );
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
        <h1 className={`${ui.heading} mt-8 text-3xl`}>Login</h1>
        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          <div>
            <label htmlFor="username" className="mb-2 block font-medium">
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.username || message)}
              aria-describedby={
                errors.username
                  ? 'username-error'
                  : message
                    ? 'login-error'
                    : undefined
              }
              className={ui.field}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            {errors.username && (
              <p
                id="username-error"
                role="alert"
                className={`${ui.error} mt-2`}
              >
                {errors.username}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.password || message)}
              aria-describedby={
                errors.password
                  ? 'password-error'
                  : message
                    ? 'login-error'
                    : undefined
              }
              className={ui.field}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className={`${ui.error} mt-2`}
              >
                {errors.password}
              </p>
            )}
          </div>
          {message && (
            <p id="login-error" role="alert" className={ui.error}>
              {message}
            </p>
          )}
          <button type="submit" className={`${buttons.primary} w-full`}>
            Login
          </button>
        </form>
        <p className="mt-6 text-sm">
          <Link to="/register" className={ui.link}>
            Register
          </Link>
        </p>
        <aside
          aria-label="Local demo guidance"
          className="mt-8 border-t border-slate-200 pt-5"
        >
          <p className="mb-3 text-sm font-medium">
            Unsafe demo Admin: username admin / password admin.
          </p>
          <p className={ui.guidance}>{demoGuidance}</p>
        </aside>
      </div>
    </main>
  );
}
