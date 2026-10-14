import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '~/db';
import { comments, feedback, feedbackTags, projectMembers, statusUpdates, tags, user, votes } from '~/db/schema';
import { currentUser, findProject, managedProject, memberRole, sessionUser } from '~/lib/access';
import { seedDemo } from '~/lib/feedback.seed';
import { demoSlug, validateId, validatePost, validateSlugInput, validateTag, validateUpdate, validateVote, validateText as text, type Post, type Tag } from '~/lib/feedback';
import { commentInsert, mergeQueries, voteInsert } from '~/lib/feedback.persistence';

/** Loads a post with the user's role on its project. Hidden posts exist only for the team. */
async function loadPost(id: string, userId?: string) {
  const [post] = await db.select().from(feedback).where(eq(feedback.id, id));
  const role = post?.projectId ? await memberRole(post.projectId, userId) : null;
  if (!post?.projectId || (post.hidden && !role)) throw new Error('This idea could not be found.');
  return { post: { ...post, projectId: post.projectId }, role };
}
async function activePost(id: string, userId?: string) {
  const found = await loadPost(id, userId);
  if (found.post.mergedIntoId) throw new Error('This idea has been merged. Please use the linked idea instead.');
  return found;
}
async function listPosts(projectId: string, options: { viewerId?: string; all?: boolean; postId?: string } = {}): Promise<Post[]> {
  const rows = await db.select({
    id: feedback.id, title: feedback.title, description: feedback.description, authorId: feedback.authorId,
    authorName: user.name, status: feedback.status, hidden: feedback.hidden, mergedIntoId: feedback.mergedIntoId,
    createdAt: feedback.createdAt, updatedAt: feedback.updatedAt,
    voteCount: sql<number>`(select count(*) from ${votes} where ${votes.postId} = ${feedback.id})`,
    commentCount: sql<number>`(select count(*) from ${comments} where ${comments.postId} = ${feedback.id} and ${comments.hidden} = 0)`,
    voted: sql<number>`exists(select 1 from ${votes} where ${votes.postId} = ${feedback.id} and ${votes.userId} = ${options.viewerId ?? ''})`,
    recentVotes: sql<number>`(select count(*) from ${votes} where ${votes.postId} = ${feedback.id} and ${votes.createdAt} > ${Date.now() - 7 * 86_400_000})`,
  }).from(feedback).innerJoin(user, eq(feedback.authorId, user.id))
    .where(and(eq(feedback.projectId, projectId), options.postId ? eq(feedback.id, options.postId) : undefined, options.all ? undefined : and(eq(feedback.hidden, false), isNull(feedback.mergedIntoId)))).orderBy(desc(feedback.createdAt));
  const associations = await db.select({ postId: feedbackTags.postId, id: tags.id, name: tags.name, color: tags.color }).from(feedbackTags).innerJoin(tags, eq(tags.id, feedbackTags.tagId)).where(options.postId ? eq(feedbackTags.postId, options.postId) : eq(tags.projectId, projectId));
  const tagsByPost = new Map<string, Tag[]>();
  for (const { postId, ...tag } of associations) {
    const postTags = tagsByPost.get(postId) ?? [];
    postTags.push(tag);
    tagsByPost.set(postId, postTags);
  }
  return rows.map(({ recentVotes, ...row }) => ({ ...row, voted: !!row.voted, trendingScore: recentVotes * 3 + row.voteCount / Math.pow(2 + Math.max(0, (Date.now() - row.createdAt) / 86_400_000), 0.7), tags: tagsByPost.get(row.id) ?? [] }));
}
const projectTags = (projectId: string) => db.select({ id: tags.id, name: tags.name, color: tags.color }).from(tags).where(eq(tags.projectId, projectId)).orderBy(tags.name);

/** A project's public board, or null when no project uses the slug. */
export const getBoard = createServerFn({ method: 'GET' }).validator(validateSlugInput).handler(async ({ data }) => {
  if (data.slug === demoSlug) await seedDemo();
  const project = await findProject(data.slug);
  if (!project) return null;
  const viewer = await currentUser();
  const [role, posts, categories] = await Promise.all([memberRole(project.id, viewer?.id), listPosts(project.id, { viewerId: viewer?.id }), projectTags(project.id)]);
  return { project, role, posts, tags: categories, demo: project.id === demoSlug };
});

export const getPost = createServerFn({ method: 'GET' }).validator((input: unknown) => ({ ...validateId(input), ...validateSlugInput(input) })).handler(async ({ data }) => {
  const viewer = await currentUser();
  const { role } = await loadPost(data.id, viewer?.id);
  const project = await findProject(data.slug);
  const [post] = project ? await listPosts(project.id, { viewerId: viewer?.id, all: true, postId: data.id }) : [];
  if (!project || !post) throw new Error('This idea could not be found.');
  const discussion = await db.select({
    id: comments.id, body: comments.body, authorId: comments.authorId, authorName: user.name, hidden: comments.hidden, createdAt: comments.createdAt,
    team: sql<number>`exists(select 1 from ${projectMembers} where ${projectMembers.projectId} = ${project.id} and ${projectMembers.userId} = ${comments.authorId})`,
  }).from(comments).innerJoin(user, eq(user.id, comments.authorId)).where(and(eq(comments.postId, data.id), role ? undefined : eq(comments.hidden, false))).orderBy(comments.createdAt);
  const updates = await db.select({ id: statusUpdates.id, status: statusUpdates.status, message: statusUpdates.message, createdAt: statusUpdates.createdAt, authorName: user.name }).from(statusUpdates).innerJoin(user, eq(user.id, statusUpdates.authorId)).where(eq(statusUpdates.postId, data.id)).orderBy(statusUpdates.createdAt);
  const voters = await db.select({ id: user.id, name: user.name }).from(votes).innerJoin(user, eq(user.id, votes.userId)).where(eq(votes.postId, data.id)).orderBy(desc(votes.createdAt)).limit(24);
  return { post, discussion: discussion.map((comment) => ({ ...comment, team: !!comment.team })), updates, voters };
});

export const createPost = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validatePost(input), ...validateSlugInput(input) })).handler(async ({ data }) => {
  const current = await sessionUser();
  const project = await findProject(data.slug);
  if (!project) throw new Error('This project could not be found.');
  if (data.tagId) {
    const [tag] = await db.select().from(tags).where(and(eq(tags.id, data.tagId), eq(tags.projectId, project.id)));
    if (!tag) throw new Error('Choose an existing category.');
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.batch([
    db.insert(feedback).values({ id, projectId: project.id, title: data.title, description: data.description, authorId: current.id, createdAt: now, updatedAt: now }),
    db.insert(votes).values({ postId: id, userId: current.id, createdAt: now }),
    ...(data.tagId ? [db.insert(feedbackTags).values({ postId: id, tagId: data.tagId })] : []),
  ]);
  return { id };
});

export const setVote = createServerFn({ method: 'POST' }).validator(validateVote).handler(async ({ data }) => {
  const current = await sessionUser();
  const { post } = await activePost(data.id);
  if (post.status === 'closed') throw new Error('Voting is closed on this idea.');
  if (data.voted) await voteInsert(db, data.id, current.id, Date.now());
  else await db.delete(votes).where(and(eq(votes.postId, data.id), eq(votes.userId, current.id)));
  return { voted: data.voted };
});

export const addComment = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateId(input), body: text((input as Record<string, unknown>).body, 'Comment', 2, 3000) })).handler(async ({ data }) => {
  const current = await sessionUser();
  const { post } = await activePost(data.id);
  if (post.status === 'closed') throw new Error('Discussion is closed on this idea.');
  const inserted = await commentInsert(db, { id: crypto.randomUUID(), postId: data.id, authorId: current.id, body: data.body, now: Date.now() }).returning({ id: comments.id });
  if (!inserted.length) throw new Error('This idea is no longer accepting comments. Refresh to see the latest update.');
  return { success: true };
});

export const removeComment = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ id: text((input as Record<string, unknown>)?.id, 'Comment ID', 1, 100) })).handler(async ({ data }) => {
  const current = await sessionUser();
  const [comment] = await db.select({ authorId: comments.authorId, projectId: feedback.projectId }).from(comments).innerJoin(feedback, eq(feedback.id, comments.postId)).where(eq(comments.id, data.id));
  if (!comment) throw new Error('Comment not found.');
  if (comment.authorId !== current.id && !(comment.projectId && (await memberRole(comment.projectId, current.id)))) throw new Error('You can only remove your own comments.');
  await db.update(comments).set({ hidden: true }).where(eq(comments.id, data.id));
  return { success: true };
});

export const getAdminBoard = createServerFn({ method: 'GET' }).validator(validateSlugInput).handler(async ({ data }) => {
  const { user: current, project, role } = await managedProject(data.slug);
  const [posts, categories] = await Promise.all([listPosts(project.id, { viewerId: current.id, all: true }), projectTags(project.id)]);
  return { project, role, posts, tags: categories };
});

export const updatePost = createServerFn({ method: 'POST' }).validator(validateUpdate).handler(async ({ data }) => {
  const current = await sessionUser();
  const { post, role } = await activePost(data.id, current.id);
  if (!role && post.authorId !== current.id) throw new Error('You can only edit your own ideas.');
  if (!role && (data.status !== post.status || data.hidden !== post.hidden || data.message || data.tagIds.sort().join(',') !== (await db.select().from(feedbackTags).where(eq(feedbackTags.postId, data.id))).map((tag) => tag.tagId).sort().join(','))) throw new Error('Only the project team can change status, visibility, or categories.');
  const foundTags = data.tagIds.length ? await db.select().from(tags).where(and(inArray(tags.id, data.tagIds), eq(tags.projectId, post.projectId))) : [];
  if (foundTags.length !== data.tagIds.length) throw new Error('One of the selected categories no longer exists.');
  await db.batch([
    db.update(feedback).set({ title: data.title, description: data.description, status: data.status, hidden: data.hidden, updatedAt: Date.now() }).where(eq(feedback.id, data.id)),
    db.delete(feedbackTags).where(eq(feedbackTags.postId, data.id)),
    ...(data.tagIds.length ? [db.insert(feedbackTags).values(data.tagIds.map((tagId) => ({ postId: data.id, tagId })))] : []),
    ...(post.status !== data.status ? [db.insert(statusUpdates).values({ id: crypto.randomUUID(), postId: data.id, authorId: current.id, status: data.status, message: data.message || `Moved to ${data.status.replace('_', ' ')}.`, createdAt: Date.now() })] : []),
  ]);
  return { success: true };
});

async function assertUniqueTagName(projectId: string, name: string, exceptId?: string) {
  const existing = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.projectId, projectId), sql`lower(${tags.name}) = ${name.toLowerCase()}`));
  if (existing.some((tag) => tag.id !== exceptId)) throw new Error('A category with this name already exists.');
}

export const createTag = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateSlugInput(input), ...validateTag(input) })).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug);
  await assertUniqueTagName(project.id, data.name);
  await db.insert(tags).values({ id: crypto.randomUUID(), projectId: project.id, name: data.name, color: data.color });
  return { success: true };
});

export const updateTag = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateSlugInput(input), ...validateId(input), ...validateTag(input) })).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug);
  await assertUniqueTagName(project.id, data.name, data.id);
  const updated = await db.update(tags).set({ name: data.name, color: data.color }).where(and(eq(tags.id, data.id), eq(tags.projectId, project.id))).returning({ id: tags.id });
  if (!updated.length) throw new Error('This category no longer exists.');
  return { success: true };
});

// Links to ideas are removed by the foreign key cascade.
export const deleteTag = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateSlugInput(input), ...validateId(input) })).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug);
  await db.delete(tags).where(and(eq(tags.id, data.id), eq(tags.projectId, project.id)));
  return { success: true };
});

export const mergePosts = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateId(input), targetId: text((input as Record<string, unknown>).targetId, 'Target ID', 1, 100) })).handler(async ({ data }) => {
  const current = await sessionUser();
  if (data.id === data.targetId) throw new Error('Choose a different idea to merge into.');
  const { post: source, role } = await activePost(data.id, current.id);
  if (!role) throw new Error('Only the project team can merge ideas.');
  const { post: target } = await activePost(data.targetId, current.id);
  if (target.projectId !== source.projectId) throw new Error('Choose an idea from the same project.');
  if (target.hidden) throw new Error('The destination must be a visible idea.');
  try {
    await db.batch(mergeQueries(db, { sourceId: data.id, targetId: data.targetId, authorId: current.id, title: source.title, status: target.status, now: Date.now(), updateId: crypto.randomUUID() }));
  } catch {
    throw new Error('The merge could not be completed. The ideas may have changed. Refresh and try again.');
  }
  return { id: data.targetId };
});
