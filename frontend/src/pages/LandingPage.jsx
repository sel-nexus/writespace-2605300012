/** Show public product copy and up to three browser-local post previews. */
import { Link } from 'react-router-dom';
import {
  BookOpen,
  PencilLine,
  Lightning,
  HardDrives,
} from '@phosphor-icons/react';
import { PublicNavbar } from '../components/PublicNavbar.jsx';
import { buttons, ui, demoGuidance } from '../components/ui.js';
import { getSession } from '../utils/auth.js';
import { getPosts } from '../utils/storage.js';
const features = [
  {
    title: 'Write Freely',
    description: 'Plain-text writing, no distractions.',
    Icon: PencilLine,
  },
  {
    title: 'Private & Local',
    description: 'Data lives in the browser.',
    Icon: HardDrives,
  },
  {
    title: 'Instant & Fast',
    description: 'No server, no lag.',
    Icon: Lightning,
  },
];
/** Convert a local date into a sortable value, placing unavailable dates last.
 * Args:
 *   value: The stored creation date.
 * Returns:
 *   A finite timestamp or negative infinity for unusable dates.
 */
function timestamp(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : -Infinity;
}
/** Format preview dates without fabricating a timestamp.
 * Args:
 *   value: The stored creation date.
 * Returns:
 *   A source-format date or neutral unavailable label.
 */
function dateLabel(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}
/** Render the guest discovery journey with escaped plain-text previews. */
export default function LandingPage() {
  const session = getSession();
  const posts = getPosts().filter(
    (post) =>
      post !== null &&
      typeof post === 'object' &&
      typeof post.id === 'string' &&
      typeof post.title === 'string' &&
      typeof post.content === 'string',
  );
  const previews = [...posts]
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
    .slice(0, 3);
  return (
    <div className={ui.page}>
      <PublicNavbar />
      <main>
        <section
          className={`${ui.container} py-12 sm:py-20`}
          aria-labelledby="hero-title"
        >
          <div className="grid items-center gap-10 rounded-2xl bg-indigo-50 p-6 sm:p-12 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <h1
                id="hero-title"
                className={`${ui.heading} text-[clamp(3rem,7vw,5.5rem)] leading-none text-indigo-950`}
              >
                WriteSpace
              </h1>
              <p className="mt-6 max-w-lg text-2xl leading-relaxed text-slate-700">
                Your thoughts. Your space. Beautifully simple.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={session ? '/blogs' : '/login'}
                  className={buttons.secondary}
                >
                  Start Reading
                </Link>
                <Link to="/register" className={buttons.primary}>
                  Get Started Free
                </Link>
              </div>
            </div>
            <div aria-hidden="true" className="relative lg:col-span-2">
              <div className="rounded-2xl border border-indigo-100 bg-white p-8 shadow-xl motion-safe:animate-bounce motion-safe:[animation-duration:5s]">
                <BookOpen
                  size={32}
                  weight="duotone"
                  className="text-indigo-600"
                />
                <p className={`${ui.heading} mt-5 text-2xl`}>
                  Your thoughts. Your space.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="h-2 rounded-full bg-slate-100" />
                  <div className="h-2 w-4/5 rounded-full bg-slate-100" />
                  <div className="h-2 w-3/5 rounded-full bg-indigo-100" />
                </div>
              </div>
            </div>
          </div>
          <p className={`${ui.guidance} mt-6`}>{demoGuidance}</p>
        </section>
        <section
          aria-label="Features"
          className={`${ui.container} grid gap-6 pb-16 md:grid-cols-3`}
        >
          {features.map(({ title, description, Icon }) => (
            <article key={title} className={ui.card}>
              <Icon
                size={24}
                weight="duotone"
                aria-hidden="true"
                className="text-indigo-600"
              />
              <h2 className={`${ui.heading} mt-4 text-2xl`}>{title}</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                {description}
              </p>
            </article>
          ))}
        </section>
        <section
          aria-labelledby="latest-title"
          className={`${ui.container} pb-20`}
        >
          <h2 id="latest-title" className={`${ui.heading} mb-8 text-3xl`}>
            Latest from the Blog
          </h2>
          {previews.length === 0 ? (
            <p className={`${ui.card} text-slate-600`}>
              No posts yet — check back soon!
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {previews.map((post) => (
                <article
                  key={post.id}
                  className={`${ui.card} min-w-0 border-t-4 border-t-indigo-500`}
                >
                  <p className="text-sm text-slate-500">
                    {dateLabel(post.createdAt)}
                  </p>
                  <h3 className={`${ui.heading} mt-3 break-words text-2xl`}>
                    <Link
                      to={
                        session
                          ? `/blog/${encodeURIComponent(post.id)}`
                          : '/login'
                      }
                      className={ui.link}
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-4 break-words leading-relaxed text-slate-600">
                    {post.content.slice(0, 120)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="bg-slate-900 py-10 text-slate-100">
        <div
          className={`${ui.container} flex flex-wrap items-center justify-between gap-6`}
        >
          <p>© {new Date().getFullYear()} WriteSpace</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-6">
            {[
              ['/', 'Home'],
              ['/blogs', 'All Blogs'],
              ['/login', 'Login'],
              ['/register', 'Register'],
            ].map(([path, label]) => (
              <Link
                key={path}
                to={path}
                className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
