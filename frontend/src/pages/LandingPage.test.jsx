/** Verify source copy, immutable preview ordering and real guest CTA navigation. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage.jsx';
import App from '../App.jsx';
import { savePosts, getPosts } from '../utils/storage.js';
import { setSession } from '../utils/auth.js';
/** Mount real landing with observable future destinations. */
function mount() {
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<p>Login destination</p>} />
        <Route path="/register" element={<p>Register destination</p>} />
        <Route path="/blogs" element={<p>Blogs destination</p>} />
        <Route path="/blog/:id" element={<p>Reader destination</p>} />
        <Route path="/admin" element={<p>Admin destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const posts = [
  {
    id: 'old',
    title: 'Oldest',
    content: 'Old content',
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'new',
    title: 'Newest',
    content: 'x'.repeat(121),
    createdAt: '2025-03-04T00:00:00Z',
  },
  {
    id: 'middle',
    title: 'Middle',
    content: '<script>escaped</script>',
    createdAt: '2024-02-02T00:00:00Z',
  },
  {
    id: 'third',
    title: 'Third',
    content: 'Third content',
    createdAt: '2023-06-01T00:00:00Z',
  },
];
describe('LandingPage', () => {
  it('renders approved copy, feature cards, footer and unsafe local guidance', () => {
    mount();
    expect(
      screen.getByRole('heading', { level: 1, name: 'WriteSpace' }),
    ).toBeVisible();
    expect(
      screen.getByText('Your thoughts. Your space. Beautifully simple.'),
    ).toBeVisible();
    for (const title of [
      'Write Freely',
      'Private & Local',
      'Instant & Fast',
      'Latest from the Blog',
    ])
      expect(screen.getByRole('heading', { name: title })).toBeVisible();
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(screen.getByText(/passwords are stored in plaintext/)).toBeVisible();
    const footer = within(
      screen.getByRole('navigation', { name: 'Footer navigation' }),
    );
    for (const [name, path] of [
      ['Home', '/'],
      ['All Blogs', '/blogs'],
      ['Login', '/login'],
      ['Register', '/register'],
    ])
      expect(footer.getByRole('link', { name })).toHaveAttribute('href', path);
    expect(
      screen.getByText(`© ${new Date().getFullYear()} WriteSpace`),
    ).toBeVisible();
    expect(localStorage.getItem('writespace_posts')).toBeNull();
  });
  it('sorts copied data newest first, caps at three, formats dates and limits escaped excerpts to 120 characters', () => {
    savePosts(posts);
    mount();
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Newest',
      'Middle',
      'Third',
    ]);
    expect(screen.queryByText('Oldest')).not.toBeInTheDocument();
    expect(screen.getByText('Mar 04, 2025')).toBeVisible();
    expect(screen.getByText('x'.repeat(120))).toBeVisible();
    expect(screen.queryByText('x'.repeat(121))).not.toBeInTheDocument();
    expect(screen.getByText('<script>escaped</script>')).toBeVisible();
    expect(document.querySelector('script')).toBeNull();
    expect(getPosts()).toEqual(posts);
  });
  it('handles invalid dates, equal dates and malformed rows without a render crash', () => {
    savePosts([
      null,
      4,
      {},
      { id: 3, title: 'Bad id', content: 'x' },
      { id: 'bad', title: {}, content: 'x' },
      { id: 'bad2', title: 'Bad', content: {} },
      { id: 'a', title: 'Missing date', content: 'a' },
      { id: 'b', title: 'Invalid date', content: 'b', createdAt: 'nonsense' },
      { id: 'c', title: 'Wrong date type', content: 'c', createdAt: 4 },
    ]);
    mount();
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['Missing date', 'Invalid date', 'Wrong date type']);
    expect(screen.getAllByText('Date unavailable')).toHaveLength(3);
  });
  it('puts invalid dates after valid pre-epoch dates and preserves ties', () => {
    savePosts([
      { id: 'bad', title: 'Unavailable', content: 'a', createdAt: 'bad' },
      {
        id: 'first',
        title: 'First tie',
        content: 'b',
        createdAt: '1960-01-01T00:00:00Z',
      },
      {
        id: 'second',
        title: 'Second tie',
        content: 'c',
        createdAt: '1960-01-01T00:00:00Z',
      },
    ]);
    mount();
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['First tie', 'Second tie', 'Unavailable']);
  });
  it.each(['{bad', '{}', '[]'])(
    'shows empty state for unusable store %s',
    (raw) => {
      localStorage.setItem('writespace_posts', raw);
      mount();
      expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
      expect(localStorage.getItem('writespace_posts')).toBe(raw);
    },
  );
  it('shows empty guest state when browser reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    mount();
    expect(screen.getByText('No posts yet — check back soon!')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Login' })).toHaveLength(2);
  });
  it.each([
    ['Start Reading', 'Login destination'],
    ['Get Started Free', 'Register destination'],
  ])('navigates guest hero %s via click', async (label, destination) => {
    mount();
    await userEvent.setup().click(screen.getByRole('link', { name: label }));
    expect(screen.getByText(destination)).toBeVisible();
  });
  it('sends a guest preview directly to login', async () => {
    savePosts(posts);
    mount();
    expect(screen.getByRole('link', { name: 'Newest' })).toHaveAttribute(
      'href',
      '/login',
    );
    await userEvent.setup().click(screen.getByRole('link', { name: 'Newest' }));
    expect(screen.getByText('Login destination')).toBeVisible();
    expect(localStorage.getItem('writespace_session')).toBeNull();
  });
  it.each(['admin', 'user'])(
    'sends authenticated %s Start Reading to blogs',
    async (role) => {
      setSession({ userId: 'u', username: 'u', displayName: 'Reader', role });
      mount();
      await userEvent
        .setup()
        .click(screen.getByRole('link', { name: 'Start Reading' }));
      expect(screen.getByText('Blogs destination')).toBeVisible();
    },
  );
  it('links authenticated previews to their encoded reader path', async () => {
    setSession({
      userId: 'u',
      username: 'u',
      displayName: 'Reader',
      role: 'user',
    });
    savePosts([{ ...posts[0], id: 'a/b' }]);
    mount();
    expect(screen.getByRole('link', { name: 'Oldest' })).toHaveAttribute(
      'href',
      '/blog/a%2Fb',
    );
    await userEvent.setup().click(screen.getByRole('link', { name: 'Oldest' }));
    expect(screen.getByText('Reader destination')).toBeVisible();
  });
});
describe('guest App route table', () => {
  it.each(['/register', '/blogs', '/admin', '/unknown'])(
    'safely redirects unmatched %s to public landing',
    (path) => {
      render(
        <MemoryRouter
          initialEntries={[path]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <App />
        </MemoryRouter>,
      );
      expect(
        screen.getByRole('heading', { level: 1, name: 'WriteSpace' }),
      ).toBeVisible();
    },
  );
  it('routes login without nesting another router', () => {
    render(
      <MemoryRouter
        initialEntries={['/login']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Login' })).toBeVisible();
  });
});
