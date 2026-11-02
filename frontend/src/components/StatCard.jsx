/** Present one settled local statistic without effects or invented trends. */
import PropTypes from 'prop-types';
import { ui } from './ui.js';

const variants = {
  default: 'text-slate-800',
  indigo: 'text-indigo-700',
  violet: 'text-violet-700',
};

/** Render a labelled count on a calm white surface.
 * Args:
 *   label: The source-defined statistic name.
 *   value: The current count, including zero.
 *   variant: The numeric accent; unknown values use the neutral default.
 * Returns:
 *   A semantic description-list entry with tabular numerics.
 */
export function StatCard({ label, value, variant = 'default' }) {
  const accent = Object.hasOwn(variants, variant)
    ? variants[variant]
    : variants.default;
  return (
    <div className={ui.card}>
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className={`mt-3 text-4xl font-bold tabular-nums ${accent}`}>
        {value}
      </dd>
    </div>
  );
}
StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  variant: PropTypes.string,
};
