/** Render static library icons for local demo roles, never uploaded images. */
import PropTypes from 'prop-types';
import { Crown, BookOpen } from '@phosphor-icons/react';
import { roleStyles } from './ui.js';
/** Present a role avatar with an accessible role label.
 * Args:
 *   role: The local account role; unknown values use the user appearance.
 * Returns:
 *   A decorative SVG inside a labelled avatar.
 */
export function Avatar({ role = 'user' }) {
  const admin = role === 'admin';
  const Icon = admin ? Crown : BookOpen;
  return (
    <span
      role="img"
      aria-label={admin ? 'Admin avatar' : 'User avatar'}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${roleStyles[admin ? 'admin' : 'user']}`}
    >
      <Icon size={20} weight="bold" aria-hidden="true" />
    </span>
  );
}
Avatar.propTypes = { role: PropTypes.string };
/** Return the shared role avatar for author and navigation consumers.
 * Args:
 *   role: The desired local role appearance.
 */
export function getAvatar(role) {
  return <Avatar role={role} />;
}
