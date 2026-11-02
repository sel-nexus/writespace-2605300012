# WriteSpace

A browser-local plain-text blog demo with guest previews, local registration/sign-in, ownership-aware publishing and Admin account management. Built with JavaScript JSX, React 18, Vite 5, React Router 6 and Tailwind 3. The only deployable component is `frontend/`.

## Important demo boundary

**Never use real passwords or sensitive content.** The fixed Admin credentials are `admin` / `admin`. Registered passwords are intentionally plaintext in localStorage. Client-side roles, sessions and ownership checks are editable by the browser owner and are not secure authorization. Data is isolated to the current browser/origin: no server, API, database, synchronization, backup or recovery. Clearing site data removes records; concurrent tabs can overwrite whole-array changes.

## Run locally

Use Node 20.18+ and npm. From the repository root:

```sh
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev -- --host 127.0.0.1 --port 5173
```

The application has no API URL or secrets. `.env.example` documents public test/dev port settings; Vite CLI ports override defaults. Do not commit `.env`. Browser `crypto.randomUUID()` requires localhost or a secure HTTPS context.

## Build and test

Run from `frontend/`:

```sh
NODE_ENV=production npm run build
npm test
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

Scripts invoke Node package entries directly and work without npm bin symlinks. Vitest uses jsdom/Testing Library with storage reset. Playwright starts a production preview when none is running; `WRITESPACE_E2E_PORT` defaults to 4173. Do not reuse an unrelated preview server. Browser fixtures fail on console and page errors. `e2e/preflight.spec.js` captures accessibility snapshots, computed styles, HTML and screenshots into ignored `test-results/` for review. `tests/integration.test.jsx` exercises local account/auth/post chains.

Verified in this stage: 472 unit/component tests plus 2 cross-feature tests; 24 browser tests; production build; Docker image build and nginx root/deep-route fallback. Source corrections resolved a whitespace-password dashboard count and a logout redirect race without weakening browser assertions. The test report records historical per-slice results and final checks.

## Routes and use

- `/`: public discovery with at most three local previews.
- `/login`, `/register`: local entry; registration always creates a user.
- `/blogs`, `/blog/:id`: authenticated list and full plain-text reader.
- `/write`, `/edit/:id`: create/edit; users manage their own writing and Admin manages all posts.
- `/admin`, `/users`: Admin overview and account creation/deletion.

Usernames are stored with outer whitespace trimmed and compared case-insensitively using en-US rules. Passwords remain exact, including whitespace. Edits preserve original post identity/date/author. Destructive actions require confirmation; account deletion cannot remove the fixed Admin or current account. Invalid storage reads render empty states, while failed writes display errors and do not claim success.

## Local record contract

- `writespace_posts`: array of `{id,title,content,createdAt,authorId,authorName}`.
- `writespace_users`: array of `{id,displayName,username,password,role,createdAt}`. The fixed Admin is not a persisted row.
- `writespace_session`: `{userId,username,displayName,role}`; removal means guest.

IDs use UUIDs; generated dates use ISO timestamps. Content is rendered as escaped text with whitespace preserved, never HTML. Malformed/unavailable arrays safely read as `[]`; malformed sessions fail closed. No migrations are needed.

## Static container and deployment

```sh
docker build -t writespace-frontend frontend
docker run --rm -p 8080:80 writespace-frontend
```

The multi-stage Node/nginx image serves static files on port 80, bound on all interfaces. Root `/` is the health path; nginx history fallback returns `index.html` for deep routes. There is no backend proxy and no durable container data. AWS release targets the pipeline-managed ECR/ECS service behind ALB/CloudFront. This stage verified the image locally but **did not deploy AWS resources or verify a public AWS URL**.

Root `vercel.json` intentionally contains only the source-required rewrite. It is a compatibility artifact, not this pipeline's release mechanism. To use Vercel separately, configure project root/build output externally for the nested frontend; no deployment configuration is silently added to the rewrite file.

## Known limitations and decisions

- The fourth dashboard metric remains undefined upstream. Only Total Posts, Total Users (registered accounts) and Total Admins (registered Admins plus fixed Admin) are shown.
- The controlling LLD account schema omits email despite a conflicting story; no email field was invented.
- Solid light surfaces and SVG role icons replace source-requested full-page rainbow gradients/emoji to satisfy this run's higher-priority UI rules. Tailwind directives/config shape and functional copy are preserved.
- Dependency patches retained the required Vite 5/Router 6 stack. The final npm audit still reports **8 findings: 5 moderate, 1 high, 2 critical**, affecting Vite/Vitest tooling and Router dependencies. Do not expose development/test servers publicly or run untrusted project inputs. Resolving all findings requires a separately validated dependency upgrade; the static demo is not security-certified. Dev dependencies are not included in the final nginx serving layer.
- No formal Lighthouse/axe audit, cross-browser certification, production latency SLO, AWS rollout or live edge check is claimed. Tests use synthetic credentials and a small local dataset.
