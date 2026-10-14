import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '~/db';
import { feedback, projectMembers, projects, tags, user, votes } from '~/db/schema';
import { managedProject, sessionUser } from '~/lib/access';
import { demoSlug, validateProject, validateSlug, validateSlugInput, validateText as text } from '~/lib/feedback';

const defaultCategories = [
  { name: 'Feature request', color: 'blue' },
  { name: 'Improvement', color: 'violet' },
  { name: 'Bug report', color: 'orange' }
];

export const listProjects = createServerFn({ method: 'GET' }).handler(async () => {
  const current = await sessionUser();
  return db.select({
    id: projects.id, slug: projects.slug, name: projects.name, description: projects.description, avatarUrl: projects.avatarUrl, role: projectMembers.role,
    ideas: sql<number>`(select count(*) from ${feedback} where ${feedback.projectId} = ${projects.id} and ${feedback.mergedIntoId} is null)`,
    votes: sql<number>`(select count(*) from ${votes} inner join ${feedback} on ${feedback.id} = ${votes.postId} where ${feedback.projectId} = ${projects.id})`
  }).from(projectMembers).innerJoin(projects, eq(projects.id, projectMembers.projectId)).where(eq(projectMembers.userId, current.id)).orderBy(desc(projects.createdAt));
});

export const createProject = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateProject(input), slug: validateSlug((input as Record<string, unknown>).slug) })).handler(async ({ data }) => {
  const current = await sessionUser();
  const [taken] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, data.slug));
  if (taken) throw new Error('This link is taken. Choose another one.');
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.batch([
    db.insert(projects).values({ id, slug: data.slug, name: data.name, description: data.description, avatarUrl: data.avatarUrl, createdAt: now }),
    db.insert(projectMembers).values({ projectId: id, userId: current.id, role: 'owner', createdAt: now }),
    db.insert(tags).values(defaultCategories.map((category) => ({ id: crypto.randomUUID(), projectId: id, ...category })))
  ]);
  return { slug: data.slug };
});

export const updateProject = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateSlugInput(input), ...validateProject(input) })).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug);
  await db.update(projects).set({ name: data.name, description: data.description, avatarUrl: data.avatarUrl }).where(eq(projects.id, project.id));
  return { success: true };
});

// Ideas, categories, and the team are removed with the project by foreign key cascades.
export const deleteProject = createServerFn({ method: 'POST' }).validator(validateSlugInput).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug, true);
  if (project.id === demoSlug) throw new Error('The demo project can’t be deleted.');
  await db.delete(projects).where(eq(projects.id, project.id));
  return { success: true };
});

export const getMembers = createServerFn({ method: 'GET' }).validator(validateSlugInput).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug);
  return db.select({ id: user.id, name: user.name, email: user.email, role: projectMembers.role }).from(projectMembers).innerJoin(user, eq(user.id, projectMembers.userId)).where(eq(projectMembers.projectId, project.id)).orderBy(projectMembers.createdAt);
});

export const addMember = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateSlugInput(input), email: text((input as Record<string, unknown>).email, 'Email', 3, 254).toLowerCase() })).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug, true);
  const [account] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${data.email}`);
  if (!account) throw new Error('No account uses this email. Ask them to sign up first.');
  const added = await db.insert(projectMembers).values({ projectId: project.id, userId: account.id, role: 'admin', createdAt: Date.now() }).onConflictDoNothing().returning({ userId: projectMembers.userId });
  if (!added.length) throw new Error('This person is already on the team.');
  return { success: true };
});

export const removeMember = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateSlugInput(input), userId: text((input as Record<string, unknown>).userId, 'Member', 1, 100) })).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug, true);
  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, data.userId), eq(projectMembers.role, 'admin')));
  return { success: true };
});
