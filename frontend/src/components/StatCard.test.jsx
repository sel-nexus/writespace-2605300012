/** Verify counts and deterministic presentation variants without storage effects. */
import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard.jsx';

it.each([0, 42])('renders the label and exact count %i', (value) => {
  render(
    <dl>
      <StatCard label="Total Posts" value={value} />
    </dl>,
  );
  expect(screen.getByRole('term')).toHaveTextContent('Total Posts');
  expect(screen.getByRole('definition')).toHaveTextContent(String(value));
  expect(screen.getByRole('definition')).toHaveClass(
    'tabular-nums',
    'text-slate-800',
  );
  expect(localStorage.length).toBe(0);
});

it.each([
  ['indigo', 'text-indigo-700'],
  ['violet', 'text-violet-700'],
  ['default', 'text-slate-800'],
  ['unknown', 'text-slate-800'],
  ['toString', 'text-slate-800'],
])(
  'handles %s using the defined variant or neutral fallback',
  (variant, accent) => {
    render(
      <dl>
        <StatCard label="Total Users" value={3} variant={variant} />
      </dl>,
    );
    expect(screen.getByRole('definition')).toHaveClass(accent);
    expect(screen.getByRole('term')).toHaveTextContent('Total Users');
    expect(screen.getByRole('definition')).toHaveTextContent('3');
  },
);
