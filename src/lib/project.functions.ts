import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '~/db';
import { feedback, projectMembers, projects, tags, user, votes } from '~/db/schema';
import { avatarSrc, managedProject, privateAvatars, sessionUser } from '~/lib/access';
import { avatarTooLarge, detectAvatarType, maxAvatarBytes } from '~/lib/avatar';
import { demoSlug, validateProject, validateSlug, validateSlugInput, validateText as text } from '~/lib/feedback';
import { getStorageErrorCode } from '~/lib/storage';

const defaultCategories = [
  { name: 'Feature request', color: 'blue' },
  { name: 'Improvement', color: 'violet' },
  { name: 'Bug report', color: 'orange' }
];

export const listProjects = createServerFn({ method: 'GET' }).handler(async () => {
  const current = await sessionUser();
  const rows = await db.select({
    id: projects.id, slug: projects.slug, name: projects.name, description: projects.description, avatarUrl: projects.avatarUrl, avatarKey: projects.avatarKey, role: projectMembers.role,
    ideas: sql<number>`(select count(*) from ${feedback} where ${feedback.projectId} = ${projects.id} and ${feedback.mergedIntoId} is null)`,
    votes: sql<number>`(select count(*) from ${votes} inner join ${feedback} on ${feedback.id} = ${votes.postId} where ${feedback.projectId} = ${projects.id})`
  }).from(projectMembers).innerJoin(projects, eq(projects.id, projectMembers.projectId)).where(eq(projectMembers.userId, current.id)).orderBy(desc(projects.createdAt));
  return Promise.all(rows.map(async ({ avatarKey, ...project }) => ({ ...project, avatarUrl: await avatarSrc({ avatarKey, avatarUrl: project.avatarUrl }) })));
});

export const createProject = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateProject(input), slug: validateSlug((input as Record<string, unknown>).slug) })).handler(async ({ data }) => {
  const current = await sessionUser();
  const [taken] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, data.slug));
  if (taken) throw new Error('This link is taken. Choose another one.');
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.batch([
    db.insert(projects).values({ id, slug: data.slug, name: data.name, description: data.description, createdAt: now }),
    db.insert(projectMembers).values({ projectId: id, userId: current.id, role: 'owner', createdAt: now }),
    db.insert(tags).values(defaultCategories.map((category) => ({ id: crypto.randomUUID(), projectId: id, ...category })))
  ]);
  return { slug: data.slug };
});

export const updateProject = createServerFn({ method: 'POST' }).validator((input: unknown) => ({ ...validateSlugInput(input), ...validateProject(input) })).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug);
  await db.update(projects).set({ name: data.name, description: data.description }).where(eq(projects.id, project.id));
  return { success: true };
});

// Browser: const form = new FormData(); form.set('slug', slug); form.set('file', file);
export const uploadProjectAvatar = createServerFn({ method: 'POST' }).validator((data: FormData) => {
  if (!(data instanceof FormData)) throw new Error('Missing request.');
  const file = data.get('file');
  if (!(file instanceof File)) throw new Error('Choose an image.');
  return { ...validateSlugInput({ slug: data.get('slug') }), file };
}).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug);
  if (data.file.size > maxAvatarBytes) throw new Error(avatarTooLarge);
  const bytes = new Uint8Array(await data.file.arrayBuffer());
  const type = detectAvatarType(bytes);
  if (!type) throw new Error('Choose a PNG, JPEG, WebP, or GIF image.');
  const oldKey = await storedAvatarKey(project.id);
  // A new key per version: public URLs are cached, so overwriting would keep showing the old image.
  const key = `projects/${project.id}/avatars/${crypto.randomUUID()}.${type.extension}`;
  try {
    await env.STORAGE.put(key, bytes, { contentType: type.contentType, visibility: privateAvatars ? 'private' : 'public' });
  } catch (error) {
    const code = getStorageErrorCode(error);
    if (code === 'StorageQuotaExceeded') throw new Error('Storage is full. Delete some files and try again.');
    if (code === 'FileTooLarge') throw new Error('This image is too large.');
    if (code === 'BlockedContent') throw new Error('This image can’t be used.');
    throw error;
  }
  if (!(await saveAvatarKey(project.id, oldKey, key))) {
    await env.STORAGE.delete(key);
    throw new Error('The avatar just changed. Refresh and try again.');
  }
  await deleteAvatar(oldKey);
  return { success: true };
});

export const removeProjectAvatar = createServerFn({ method: 'POST' }).validator(validateSlugInput).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug);
  const oldKey = await storedAvatarKey(project.id);
  if (!(await saveAvatarKey(project.id, oldKey, ''))) throw new Error('The avatar just changed. Refresh and try again.');
  await deleteAvatar(oldKey);
  return { success: true };
});

async function storedAvatarKey(projectId: string) {
  const [row] = await db.select({ avatarKey: projects.avatarKey }).from(projects).where(eq(projects.id, projectId));
  return row?.avatarKey ?? '';
}

/** Replaces the avatar only if it's still `oldKey`, so concurrent changes can't orphan a file. Clears any older image URL. */
async function saveAvatarKey(projectId: string, oldKey: string, key: string) {
  const saved = await db.update(projects).set({ avatarKey: key, avatarUrl: '' }).where(and(eq(projects.id, projectId), eq(projects.avatarKey, oldKey))).returning({ id: projects.id });
  return saved.length > 0;
}

// Runs after the new avatar is saved, so a failed cleanup only leaves an unused file behind.
async function deleteAvatar(key: string) {
  if (!key) return;
  try {
    await env.STORAGE.delete(key);
  } catch (error) {
    console.warn(`[storage] could not delete old avatar ${key}`, error);
  }
}

// Ideas, categories, and the team are removed with the project by foreign key cascades.
export const deleteProject = createServerFn({ method: 'POST' }).validator(validateSlugInput).handler(async ({ data }) => {
  const { project } = await managedProject(data.slug, true);
  if (project.id === demoSlug) throw new Error('The demo project can’t be deleted.');
  const avatarKey = await storedAvatarKey(project.id);
  await db.delete(projects).where(eq(projects.id, project.id));
  await deleteAvatar(avatarKey);
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
