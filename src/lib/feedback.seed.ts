import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '~/db';
import { comments, feedback, feedbackTags, projects, tags, user, votes, wishboxMeta, statusUpdates } from '~/db/schema';
import { demoSlug, type FeedbackStatus } from '~/lib/feedback';

type Example = { title: string; description: string; status: FeedbackStatus; tags: string[]; votes: number; days: number; comments: string[]; update?: string };

// Indexes and statuses match the first sample set, so upgrading an existing
// board rewrites rows in place instead of leaving stale status history.
const examples: Example[] = [
  {
    title: 'Dark mode',
    description: 'Most of our team works late, and the bright interface is tiring after a few hours. A dark theme that follows the system setting would be ideal.',
    status: 'in_progress', tags: ['feature', 'design'], votes: 48, days: 12,
    comments: [
      'Please make it follow the OS setting rather than a separate toggle.',
      'The white background is rough on an external monitor at night.',
      'Bonus if charts get proper dark colors too, not just the background.'
    ],
    update: 'Design is done and we’re building it now. Expect a beta in a couple of weeks.'
  },
  {
    title: 'Slack notifications when a task changes status',
    description: 'We’d like a message in a Slack channel when a task moves to Done, so the team doesn’t have to keep checking the project.',
    status: 'planned', tags: ['feature'], votes: 36, days: 8,
    comments: [
      'Same for Microsoft Teams, if possible.',
      'Choosing which statuses trigger a message would keep the channel quiet.',
      'This would replace a Zapier workflow we maintain today.'
    ],
    update: 'Scheduled for next quarter. We’ll start with Slack and look at Teams after.'
  },
  {
    title: 'Export tasks to CSV',
    description: 'Our managers review progress in a spreadsheet every month. An export with title, assignee, status, and due date would save a lot of copying.',
    status: 'open', tags: ['improvement'], votes: 32, days: 5,
    comments: [
      'Custom fields need to be included for this to work for us.',
      'Exporting only the current filter would be even better.',
      'We copy this by hand today, so anything would help.'
    ]
  },
  {
    title: 'Recurring tasks',
    description: 'Some of our work repeats every week or month. It would help to set a task to recur instead of recreating it each time.',
    status: 'open', tags: ['feature'], votes: 27, days: 3,
    comments: [
      'Monthly on a specific weekday (e.g. the first Monday) is the case we need most.',
      'Please keep the comment history separate for each occurrence.'
    ]
  },
  {
    title: 'Attach images to comments',
    description: 'A screenshot is often the fastest way to explain a problem. Pasting an image into a comment would make discussions much clearer.',
    status: 'planned', tags: ['feature', 'design'], votes: 24, days: 6,
    comments: [
      'Paste from clipboard is the key part for us.',
      'A file size limit is fine. PNG and JPG would cover most cases.'
    ],
    update: 'Planned. We’re settling storage limits first.'
  },
  {
    title: 'Keyboard shortcuts',
    description: 'Shortcuts for search, creating a task, and switching projects would make the app much faster for people who use it all day.',
    status: 'open', tags: ['improvement'], votes: 19, days: 2,
    comments: [
      'A cheat sheet on “?” like most apps would be great.',
      'Please make them configurable. Some conflict with our browser extensions.'
    ]
  },
  {
    title: 'Remember filters when going back',
    description: 'After opening an item and going back, the list resets to the default filters. It should keep the filters I had.',
    status: 'completed', tags: ['improvement'], votes: 16, days: 15,
    comments: [
      'This one gets me several times a day.',
      'Keeping the scroll position would be nice too.'
    ],
    update: 'Shipped. Filters now live in the URL, so they also survive a refresh and can be shared.'
  },
  {
    title: 'Search ignores task descriptions',
    description: 'Search only matches titles. If the word I’m looking for is in the description, the task doesn’t show up.',
    status: 'completed', tags: ['bug'], votes: 12, days: 18,
    comments: [
      'Noticed the same thing last week.',
      'Hit this again today while searching for an error code.'
    ],
    update: 'Fixed. Search now matches descriptions as well as titles.'
  },
  {
    title: 'Buttons are too small on mobile',
    description: 'On a phone the vote and menu buttons are hard to tap without hitting something else. They need larger touch targets.',
    status: 'open', tags: ['bug', 'design'], votes: 8, days: 1,
    comments: [
      'Same on iPad in split view.',
      'Happens on Android too.'
    ]
  }
];

// The demo project linked from the landing page, seeded on its first visit.
// These profiles have no login credentials. Bump the version to refresh the
// sample text on boards seeded earlier.
const demoVersion = 'demo-v1';
export async function seedDemo() {
  const [marker] = await db.select().from(wishboxMeta).where(eq(wishboxMeta.key, demoVersion));
  if (marker) return;
  const now = Date.now();
  const names = ['Alex Morgan', 'Sarah Chen', 'James Wilson', 'Olivia Martin', 'Noah Patel', 'Emma Davis', 'Leo Garcia', 'Mia Anderson'];
  type Query = Parameters<typeof db.batch>[0][number];
  const project = { name: 'Acme', description: 'Ideas and requests for Acme, the task manager for small teams.' };
  const operations: Query[] = [db.insert(projects).values({ id: demoSlug, slug: demoSlug, ...project, createdAt: now }).onConflictDoUpdate({ target: projects.id, set: project })];
  for (let offset = 0; offset < 48; offset += 6) {
    operations.push(db.insert(user).values(Array.from({ length: 6 }, (_, index) => {
      const i = offset + index;
      return { id: `example-user-${i}`, name: names[i % names.length]!, email: `example-${i}@wishbox.invalid`, role: 'user', emailVerified: false, createdAt: new Date(now), updatedAt: new Date(now) };
    })).onConflictDoNothing());
  }
  operations.push(db.insert(tags).values([
    { id: 'feature', projectId: demoSlug, name: 'Feature request', color: 'blue' },
    { id: 'improvement', projectId: demoSlug, name: 'Improvement', color: 'violet' },
    { id: 'bug', projectId: demoSlug, name: 'Bug report', color: 'orange' },
    { id: 'design', projectId: demoSlug, name: 'Design', color: 'pink' },
  ]).onConflictDoNothing());
  operations.push(db.delete(feedbackTags).where(inArray(feedbackTags.postId, examples.map((_, i) => `example-${i + 1}`))));
  examples.forEach((example, i) => {
    const id = `example-${i + 1}`;
    const createdAt = now - example.days * 86_400_000;
    const content = { projectId: demoSlug, title: example.title, description: example.description, status: example.status };
    operations.push(db.insert(feedback).values({ id, ...content, authorId: `example-user-${i}`, createdAt, updatedAt: createdAt }).onConflictDoUpdate({ target: feedback.id, set: content }));
    operations.push(db.insert(feedbackTags).values(example.tags.map((tagId) => ({ postId: id, tagId }))).onConflictDoNothing());
    for (let offset = 0; offset < example.votes; offset += 20) {
      operations.push(db.insert(votes).values(Array.from({ length: Math.min(20, example.votes - offset) }, (_, j) => ({ postId: id, userId: `example-user-${offset + j}`, createdAt: createdAt + j * 360_000 }))).onConflictDoNothing());
    }
    operations.push(db.insert(comments).values(example.comments.map((body, j) => ({ id: `example-comment-${i}-${j}`, postId: id, authorId: `example-user-${(i + j + 1) % 8}`, body, createdAt: createdAt + (j + 1) * 3_600_000 }))).onConflictDoUpdate({ target: comments.id, set: { body: sql`excluded.body` } }));
    if (example.update) operations.push(db.insert(statusUpdates).values({ id: `example-update-${i}`, postId: id, authorId: 'example-user-0', status: example.status, message: example.update, createdAt: now - 86_400_000 }).onConflictDoUpdate({ target: statusUpdates.id, set: { message: example.update } }));
  });
  operations.push(db.insert(wishboxMeta).values({ key: demoVersion, value: 'Demo project' }).onConflictDoNothing());
  await db.batch(operations as [Query, ...Query[]]);
}
