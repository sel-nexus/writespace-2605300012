/** Centralize the approved light surfaces, control states and editorial typography. */
const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const control = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors duration-200 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
export const buttons = {
  primary: `${control} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700`,
  secondary: `${control} border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50`,
  ghost: `${control} text-slate-600 hover:bg-slate-100`,
};
export const ui = {
  page: 'min-h-screen bg-slate-50 font-sans text-slate-800',
  container: 'mx-auto max-w-6xl px-4 sm:px-6',
  card: 'rounded-2xl border border-slate-200 bg-white p-6',
  heading: 'font-serif font-bold tracking-tight',
  field: `block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 ${focus}`,
  link: `rounded text-indigo-600 underline-offset-4 hover:underline ${focus}`,
  error: 'rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700',
  guidance: 'text-sm leading-relaxed text-slate-600',
};
export const roleStyles = { admin: 'bg-violet-600', user: 'bg-indigo-500' };
export const demoGuidance =
  'Unsafe local demo: passwords are stored in plaintext in this browser. Do not use real passwords or sensitive content. There is no server, synchronization, backup, or production security. Browser data can be changed or cleared; concurrent tabs can overwrite changes.';
