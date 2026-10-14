# Wishbox

A starter for a multi-tenant product feedback SaaS, in the spirit of Canny or
Featurebase. Teams sign up on the main site and create projects; each project
gets a public feedback board and roadmap where the team's own users sign in,
post ideas, vote, and comment.

Built with React, TypeScript, TanStack Start and Query, Tailwind CSS,
shadcn/ui, Tiptap, Better Auth, Drizzle ORM, Cloudflare D1, and Cloudflare
Workers. Licensed under MIT.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | Everyone | Landing page with animated previews and a link to the demo board |
| `/sign-in`, `/sign-up` | Teams | Account access for the dashboard |
| `/dashboard` | Signed in | Projects you belong to, and creating new ones |
| `/dashboard/$slug` | Project team | Ideas, Categories, Team, and Settings tabs |
| `/account` | Signed in | Display name and password |
| `/p/$slug` | Everyone | The project's public board |
| `/p/$slug/roadmap` | Everyone | Planned, in progress, and completed ideas |
| `/p/$slug/ideas/$id` | Everyone | An idea with its votes, comments, and status history |

`/p/demo` is a seeded demo project (Acme). It is created on its first visit in
every environment, has no team, and anyone signed in can post to it.

## Features

- **Projects:** name, link (`/p/<slug>`, fixed after creation), description,
  and an avatar. The avatar is an image URL; uploads aren't supported. It shows
  in the dashboard, the project switcher, the board header, and as the board's
  favicon, and falls back to a letter mark when the image can't load.
- **Two kinds of sign-in, one account system:** teams sign in on the main site;
  board visitors sign in from a dialog on the board itself and return to what
  they were doing (posting, voting, commenting). Email/password, email sign-in
  codes, and password reset by code.
- **Boards:** search, category and status filters, sorting by votes, newest, or
  trending, and "My ideas". Filters are shareable URL parameters. New ideas
  suggest similar existing ones while the title is typed.
- **Rich text** for idea descriptions and comments, edited with Tiptap: bold,
  italic, links, bulleted and numbered lists, and quotes, with toolbar buttons,
  shortcuts (Cmd/Ctrl+B, I, K; `- `, `1. `, `> ` at the start of a line;
  Cmd/Ctrl+Enter posts a comment), and paste from other apps. Content is stored
  as a small Markdown subset (see `src/lib/rich-text.ts`), converted to and from
  the editor's document in `src/lib/rich-text-doc.ts`. Rendering escapes all
  text and only links http(s) and mailto URLs. Plain text from before the
  editor reads as paragraphs.
- **Dashboard:** stats, public/hidden/merged idea lists with inline status,
  edit, hide/show, and merge. Merging is atomic in D1, moves unique votes,
  comments, tags, and status history, and is irreversible. Categories can be
  created, renamed, recolored, and deleted.
- Light and dark themes that follow the system, with a manual toggle.

Email notifications, billing, custom domains, and integrations are left to you.

## Access

Each project has a team in `project_member` with the role `owner` or `admin`.
Creating a project makes you its owner.

- Admins and owners moderate ideas, manage categories, and edit settings.
- Only the owner adds or removes teammates (by the email of an existing
  account) and deletes the project.
- Everyone else is a visitor: they can post, vote, comment, edit their own
  ideas, and delete their own comments.

All checks run on the server. Dashboards of projects you're not on answer
"not found", so their slugs don't leak. Accounts banned through Better Auth's
admin plugin (set in the database) can't make changes anywhere.

## Data And Development

Projects, ideas, categories, votes, comments, and status updates live in D1
through Drizzle, scoped by project. A composite primary key guarantees one vote
per user per idea. Public queries exclude hidden and merged ideas. Write-time
checks keep votes and comments off merged, hidden, or closed ideas.

The `projects` migration moves a board created before projects existed into the
demo project without losing its data. Demo profiles use `wishbox.invalid`
addresses and have no passwords. Bump `demoVersion` in
`src/lib/feedback.seed.ts` to refresh the demo text.

Layerwise owns the development server. Do not start, stop, or restart it.

```bash
pnpm run db:generate
pnpm run db:migrate
pnpm run check-types
pnpm run test
pnpm run build
```

The tests use Node 24+ built-in SQLite, TypeScript support, and module hooks.
They cover validation; board filtering and sorting; rich text round trips,
escaping, and editor document conversion; real Drizzle SQL against the
generated migrations; unique voting; write-time restrictions; cross-project
merges; and atomic merging with rollback. They don't replace browser or
end-to-end authentication tests.

Define the schema in `src/db/schema.ts`, generate migrations with Drizzle, and
apply them with `db:migrate`. Layerwise applies the same migrations to
production when publishing. Never hand-edit migration history.

## Environment

Keep `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `AUTH_EMAIL_URL` server-side.
Layerwise supplies the D1 binding and authentication email integration.
Authentication email delivery errors stay visible in the UI. When no
authentication email endpoint is available, the development helper logs OTPs.

Wishbox's source, CSS, copy, and logo are original. Fider's public feedback
patterns were a product reference only; no Fider code or assets were used.
Existing dependency licenses remain in their respective packages.
