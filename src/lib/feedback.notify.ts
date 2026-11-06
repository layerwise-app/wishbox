import { getRequestUrl } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { projects, user } from '~/db/schema';
import type {} from '~/lib/email';
import type { IdeaEmail, IdeaEmailContext } from '~/lib/feedback.email';

/**
 * Emails an idea's author about something the team did. The address comes from
 * the author's account, never from the request. Skips the actor's own ideas.
 * Never throws: a failed email must not fail the change that already happened.
 */
export async function notifyIdeaAuthor(
  notice: { authorId: string; actorId: string; projectId: string; linkId: string },
  build: (context: IdeaEmailContext) => IdeaEmail
) {
  if (notice.authorId === notice.actorId) return;
  try {
    const [recipient] = await db
      .select({ email: user.email, projectName: projects.name, slug: projects.slug })
      .from(user)
      .innerJoin(projects, eq(projects.id, notice.projectId))
      .where(eq(user.id, notice.authorId));
    // Demo profiles use `wishbox.invalid` addresses, which can't receive email.
    if (!recipient || recipient.email.endsWith('.invalid')) return;
    const url = new URL(`/p/${recipient.slug}/ideas/${notice.linkId}`, getRequestUrl().origin).href;
    const { error } = await env.EMAIL.send({ to: recipient.email, ...build({ projectName: recipient.projectName, url }) });
    if (error) console.warn(`[email] idea ${notice.linkId}: ${error.code} ${error.message}`);
  } catch (error) {
    console.warn(`[email] idea ${notice.linkId}: could not send`, error);
  }
}
