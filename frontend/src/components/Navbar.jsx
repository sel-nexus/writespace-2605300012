/** Present native role navigation and explicit, failure-aware local logout. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { List, X, CaretDown } from '@phosphor-icons/react';
import { Avatar } from './Avatar.jsx';
import { buttons, ui } from './ui.js';
import { clearSession } from '../utils/auth.js';

/** Compose an authenticated header with independently toggled mobile and account panels.
 * Args:
 *   session: The current validated local identity supplied by the app shell.
 * Returns:
 *   Accessible links and buttons; opening either panel never clears storage.
 */
export function Navbar({ session }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
    setError('');
  }, [location.key]);

  /** Remove the session only on activation and remain actionable on failure. */
  function logout() {
    try {
      clearSession();
      navigate('/');
    } catch {
      setError('Logout could not be completed in this browser.');
    }
  }
  const links = [['/blogs', 'All Blogs'], ['/write', 'Write']];
  if (session.role === 'admin') links.push(['/users', 'Users']);
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav aria-label="Authenticated navigation" className={`${ui.container} flex flex-wrap items-center gap-3 py-3`}>
        <Link to="/" className={`${ui.link} font-serif text-xl font-bold no-underline`}>WriteSpace</Link>
        <button
          type="button"
          className={`${buttons.ghost} ml-auto sm:hidden`}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          aria-controls="authenticated-links"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} aria-hidden="true" /> : <List size={24} aria-hidden="true" />}
        </button>
        <div
          id="authenticated-links"
          className={`${mobileOpen ? 'flex' : 'hidden'} order-3 w-full flex-col gap-2 sm:order-none sm:flex sm:w-auto sm:flex-row`}
        >
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${buttons.ghost} rounded-full ${isActive ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
        <div className="relative sm:ml-auto">
          <button
            type="button"
            className={buttons.ghost}
            aria-expanded={dropdownOpen}
            aria-controls="account-actions"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <Avatar role={session.role} />
            <span className="max-w-40 truncate">{session.displayName}</span>
            <CaretDown size={16} aria-hidden="true" />
          </button>
          {dropdownOpen && (
            <div id="account-actions" className="absolute right-0 top-full rounded-lg border border-slate-200 bg-white p-2 shadow-md">
              <button type="button" onClick={logout} className={buttons.ghost}>Logout</button>
            </div>
          )}
        </div>
        {error && <p role="alert" className={`${ui.error} w-full`}>{error}</p>}
      </nav>
    </header>
  );
}
Navbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired, username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }).isRequired,
};
