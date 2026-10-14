import { getRequestHeaders } from '@tanstack/react-start/server';
import { and, eq } from 'drizzle-orm';
import { db } from '~/db';
import { projectMembers, projects } from '~/db/schema';
import { auth } from '~/lib/auth';
import type { Project, ProjectRole } from '~/lib/feedback';

/** The signed-in user, or null for visitors and banned accounts. */
export async function currentUser() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return session && !session.user.banned ? session.user : null;
}

export async function sessionUser() {
  const current = await currentUser();
  if (!current) throw new Error('Please sign in to continue.');
  return current;
}

export async function findProject(slug: string): Promise<Project | null> {
  const [project] = await db.select({ id: projects.id, slug: projects.slug, name: projects.name, description: projects.description, avatarUrl: projects.avatarUrl }).from(projects).where(eq(projects.slug, slug));
  return project ?? null;
}

/** The user's role on the project's team, or null when they are a visitor. */
export async function memberRole(projectId: string, userId: string | undefined): Promise<ProjectRole | null> {
  if (!userId) return null;
  const [member] = await db.select({ role: projectMembers.role }).from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  return member?.role ?? null;
}

/** Resolves a dashboard request to a project the signed-in user manages. */
export async function managedProject(slug: string, ownerOnly = false) {
  const current = await sessionUser();
  const project = await findProject(slug);
  const role = project && (await memberRole(project.id, current.id));
  // Visitors get the same answer as for a missing project, so slugs of private dashboards don't leak.
  if (!project || !role) throw new Error('This project could not be found.');
  if (ownerOnly && role !== 'owner') throw new Error('Only the project owner can do this.');
  return { user: current, project, role };
}
