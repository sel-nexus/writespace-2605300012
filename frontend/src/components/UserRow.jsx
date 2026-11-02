/** Present one account as a semantic desktop row or real mobile card. */
import PropTypes from "prop-types";
import { Avatar } from "./Avatar.jsx";
import { buttons, ui } from "./ui.js";
import { isDefaultAdmin } from "../utils/accounts.js";
import { formatPostDate } from "../utils/posts.js";
const badges = {
  admin: "bg-violet-100 text-violet-700 ring-violet-300",
  user: "bg-indigo-100 text-indigo-700 ring-indigo-300",
};

/** Render identity, role, date and an explicit deletion control.
 * Args:
 *   account: A renderable local or synthetic built-in record.
 *   currentUserId: The session identity protected from deletion.
 *   onDelete: The page-owned confirmation handler.
 *   mobile: Select card markup instead of table markup.
 *   adminAccess: Disable actions when Admin access is absent.
 */
export function UserRow({
  account,
  currentUserId,
  onDelete,
  mobile = false,
  adminAccess = true,
}) {
  const fixed = isDefaultAdmin(account);
  const self = account.id === currentUserId;
  const reason = fixed
    ? "Default admin cannot be deleted."
    : self
      ? "You cannot delete your current account."
      : !adminAccess
        ? "Admin access is required."
        : undefined;
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={account.role} />
      <div className="min-w-0 break-words">
        <p className="font-semibold">{account.displayName}</p>
        <p className="text-sm text-slate-600">{account.username.trim()}</p>
      </div>
    </div>
  );
  const badge = (
    <span
      role="status"
      className={`inline-flex rounded-full px-3 py-0.5 text-sm font-medium ring-1 ${badges[account.role]}`}
    >
      {account.role === "admin" ? "Admin" : "user"}
    </span>
  );
  const date = fixed ? "Built-in account" : formatPostDate(account.createdAt);
  const action = (
    <span title={reason}>
      <button
        type="button"
        aria-label={`Delete ${account.displayName}`}
        disabled={Boolean(reason)}
        title={reason}
        onClick={() => onDelete(account.id)}
        className={`${buttons.ghost} border border-red-200 bg-red-50 text-red-600 hover:bg-red-100`}
      >
        Delete
      </button>
    </span>
  );
  if (mobile)
    return (
      <li aria-label={`Account ${account.username.trim()}`} className={ui.card}>
        {identity}
        <dl className="my-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <dt>Role</dt>
            <dd>{badge}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <dt>Created</dt>
            <dd className="text-sm text-slate-600">{date}</dd>
          </div>
        </dl>
        {action}
      </li>
    );
  return (
    <tr>
      <td className="p-4">{identity}</td>
      <td className="p-4">{badge}</td>
      <td className="p-4 text-sm text-slate-600">{date}</td>
      <td className="p-4 text-right">{action}</td>
    </tr>
  );
}
UserRow.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  currentUserId: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
  adminAccess: PropTypes.bool,
};
