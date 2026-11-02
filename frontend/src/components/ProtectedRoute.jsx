/** Guard local demo routes without claiming server-enforced authorization. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { getSession } from '../utils/auth.js';

/** Redirect guests and disallowed roles before rendering children.
 * Args:
 *   children: The protected view.
 *   adminOnly: Whether the view requires the Admin role.
 * Returns:
 *   The permitted view or a replacement navigation.
 */
export function ProtectedRoute({ children, adminOnly = false }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children;
}
ProtectedRoute.propTypes = { children: PropTypes.node.isRequired, adminOnly: PropTypes.bool };
