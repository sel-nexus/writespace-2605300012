/** Browse the current local collection without mutating it during reads. */
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { buttons, ui } from '../components/ui.js';
import { orderedPosts } from '../utils/posts.js';
import { getSession } from '../utils/auth.js';

/** Display newest-first previews or the exact source empty state.
 * Returns:
 *   A responsive one, two or three-column collection with a writing action.
 */
export default function Home() {
  const posts = orderedPosts();
  const session = getSession();
  return (
    <main className={`${ui.container} py-12`}>
      <h1 className={`${ui.heading} mb-8 text-4xl`}>All Blogs</h1>
      {posts.length === 0 ? (
        <section className={`${ui.card} space-y-6 text-center`}>
          <p>No blogs yet. Be the first to write one!</p>
          <Link to="/write" className={buttons.primary}>Write</Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => <BlogCard key={`${post.id}-${index}`} post={post} index={index} session={session} />)}
        </div>
      )}
    </main>
  );
}
