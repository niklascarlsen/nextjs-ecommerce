# Next.js Clothing Retail

A full-stack application implementing Postgres full-text search with a trigram fallback, cursor-based pagination, recursive navigation structures, and guest-to-account session merging. It covers the complete flow from product discovery to multi-step checkout, alongside a dedicated admin area for inventory and orders.

## Features

### Search

Search is split into pure string handling (`lib/search-query.ts`), reusable SQL fragments (`actions/lib/search-builder.ts`), and the query itself. It runs in two modes:

- **`fts` (default)** - Postgres full-text search. Matches are ranked by where they hit: the product name counts most, then color, category, and gender, so the most relevant products come first. Each word matches as a prefix (so "jack" finds "jacket"), and the query is cleaned up and expanded with synonyms (e.g. t-shirt = tshirt) before it runs. It reads from a precomputed, indexed search column, so it stays fast as the catalog grows.
- **`fuzzy` (fallback)** - when full-text finds nothing, it retries with trigram similarity (matching on overlapping letter chunks) so small typos like "nikee" still find "Nike".

### Product grid & data fetching

The product grid (`getInfiniteProducts`) uses **cursor-based pagination** sorted by price, name, or id, with relevance ranking applied automatically while searching, so pages stay stable as the catalog changes and never skip or repeat rows. Server Components render the first page during SSR and pass it as the initial cache entry for `useInfiniteQuery` - TanStack Query then owns client-side caching and fetches subsequent pages on scroll.

Grid density is user-adjustable - `compact` (2 columns on mobile, up to 4 on desktop) and `comfortable` (1 on mobile, 2 on desktop). The product card adapts to the layout and items can be added to the cart without leaving the listing.

### Navigation

The header nav comes from the `categories` table, where each row has a `parentId`. A recursive function turns that flat list into a nested `NavLink[]` tree, joining each level's slug into the path. One structure drives two different UIs:

- **Desktop** - a mega-menu where top-level tabs open a multi-column dropdown that reveals one column per tree level, tracked by an `activePath` (e.g. `[0, 2, 1]`). Dropdown width is measured from the DOM rather than hardcoded.
- **Mobile** - a drawer built on a navigation stack: each folder pushes a new view (slide forward), the back button pops it (slide back), and leaf links close the drawer and navigate.


### Accessibility

Built to be fully operable by keyboard and screen-reader users: focus traps and scroll-locked overlays, dismissible dropdown/popover patterns, keyboard shortcuts, and route-change focus management (`RouteFocusManager` moves focus to `<main>` on navigation).

### Auth & guest sessions

Cart and favorites work for anonymous users via an httpOnly `cart_session_id` cookie. Rows carry either a `user_id` or a `session_id`. On login the NextAuth `signIn` callback merges guest cart/favorites into the account and drops the cookie.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Data:** PostgreSQL, Drizzle ORM (migration-based), `decimal.js` for integer-safe money math
- **Client data/cache:** TanStack Query
- **Auth:** NextAuth.js (database sessions, Drizzle adapter, Google/GitHub OAuth)
- **UI:** Tailwind CSS v4, Framer Motion
- **Forms / validation:** React Hook Form, Zod
- **Testing / CI:** Vitest, GitHub Actions (typecheck + lint + test)

## Local development

Prerequisites: Node.js, PostgreSQL, `npm i`.

1. Copy `.env.example` to `.env` and set `DB_URL` + `DB_SSL`. Create the local database if it does not exist (`createdb db`).

   ```env
   # Local PostgreSQL
   DB_URL=postgresql://USER:PASSWORD@localhost:5432/db
   DB_SSL=false

   # Neon
   # DB_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
   # DB_SSL=true

   # Auth (base requirement)
   AUTH_SECRET=generate-with-openssl-rand-base64-32
   AUTH_URL=http://localhost:3000
   ```

2. Apply migrations, seed sample data, and start the dev server:

   ```bash
   npm run db:migrate
   npm run seed:c
   npm run seed:p
   npm run dev
   ```

_Optional:_ To enable OAuth login, add Google/GitHub client IDs and secrets to `.env`. For temporary unrestricted access to `/admin` (and admin server actions) without logging in or setting `role = 1`, set `ADMIN_DEV_BYPASS=true` in `.env`. It is ignored when `NODE_ENV=production`.
