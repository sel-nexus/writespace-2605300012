/** Provide public navigation and a session-derived role-home action. */
import { Link } from 'react-router-dom';
import { BookOpen } from '@phosphor-icons/react';
import { getSession } from '../utils/auth.js';
import { Avatar } from './Avatar.jsx';
import { buttons, ui } from './ui.js';
/** Render guest actions or the validated local identity without mutating storage. */
export function PublicNavbar() {
  const session = getSession();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav
        aria-label="Public navigation"
        className={`${ui.container} flex flex-wrap items-center justify-between gap-3 py-3`}
      >
        <Link
          to="/"
          className={`${ui.link} flex items-center gap-2 text-xl font-bold no-underline`}
        >
          <BookOpen size={24} weight="bold" aria-hidden="true" />
          <span>WriteSpace</span>
        </Link>
        {session ? (
          <div className="flex flex-wrap items-center gap-3">
            <Avatar role={session.role} />
            <span className="max-w-40 break-words font-medium">
              {session.displayName}
            </span>
            <Link
              to={session.role === 'admin' ? '/admin' : '/blogs'}
              className={buttons.primary}
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className={buttons.ghost}>
              Login
            </Link>
            <Link to="/register" className={buttons.primary}>
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
