import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { comments, feedback, feedbackTags, statusUpdates, votes, wishboxMeta } from '~/db/schema';
import type { db } from '~/db';

type Database = typeof db;
export function voteInsert(database: Database, postId: string, userId: string, now: number) {
  return database.insert(votes).select(database.select({ postId: feedback.id, userId: sql<string>`${userId}`.as('user_id'), createdAt: sql<number>`${now}`.as('created_at') }).from(feedback).where(and(eq(feedback.id, postId), eq(feedback.hidden, false), isNull(feedback.mergedIntoId), ne(feedback.status, 'closed')))).onConflictDoNothing();
}
export function commentInsert(database: Database, input: { id: string; postId: string; authorId: string; body: string; now: number }) {
  return database.insert(comments).select(database.select({ id: sql<string>`${input.id}`.as('id'), postId: feedback.id, authorId: sql<string>`${input.authorId}`.as('author_id'), body: sql<string>`${input.body}`.as('body'), hidden: sql<boolean>`0`.as('hidden'), createdAt: sql<number>`${input.now}`.as('created_at') }).from(feedback).where(and(eq(feedback.id, input.postId), eq(feedback.hidden, false), isNull(feedback.mergedIntoId), ne(feedback.status, 'closed'))));
}
export function mergeQueries(database: Database, input: { sourceId: string; targetId: string; authorId: string; title: string; status: string; now: number; updateId: string }) {
  const source = alias(feedback, 'merge_source');
  const target = alias(feedback, 'merge_target');
  // INSERT ... SELECT captures all votes at transaction time. The composite
  // primary key removes overlap without inflating the destination vote count.
  return [
    // A NOT NULL/unique guard aborts the entire batch if another administrator
    // has already merged either idea, preventing duplicate merges and cycles, or
    // if the ideas belong to different projects.
    database.insert(wishboxMeta).select(database.select({ key: sql<string>`${`merge:${input.sourceId}`}`.as('key'), value: sql<string>`case when ${source.id} <> ${target.id} and ${source.projectId} = ${target.projectId} and ${source.mergedIntoId} is null and ${target.mergedIntoId} is null and ${target.hidden} = 0 and ${target.status} = ${input.status} then ${input.targetId} else null end`.as('value') }).from(source).innerJoin(target, eq(target.id, input.targetId)).where(eq(source.id, input.sourceId))),
    database.insert(votes).select(database.select({ postId: sql<string>`${input.targetId}`.as('post_id'), userId: votes.userId, createdAt: votes.createdAt }).from(votes).where(eq(votes.postId, input.sourceId))).onConflictDoNothing(),
    database.insert(feedbackTags).select(database.select({ postId: sql<string>`${input.targetId}`.as('post_id'), tagId: feedbackTags.tagId }).from(feedbackTags).where(eq(feedbackTags.postId, input.sourceId))).onConflictDoNothing(),
    database.update(comments).set({ postId: input.targetId }).where(eq(comments.postId, input.sourceId)),
    database.update(statusUpdates).set({ postId: input.targetId }).where(eq(statusUpdates.postId, input.sourceId)),
    database.update(feedback).set({ updatedAt: input.now }).where(eq(feedback.id, input.targetId)),
    database.delete(votes).where(eq(votes.postId, input.sourceId)),
    database.update(feedback).set({ mergedIntoId: input.targetId, updatedAt: input.now }).where(eq(feedback.id, input.sourceId)),
    database.update(feedback).set({ mergedIntoId: input.targetId }).where(eq(feedback.mergedIntoId, input.sourceId)),
    database.insert(statusUpdates).values({ id: input.updateId, postId: input.targetId, authorId: input.authorId, status: input.status, message: `Merged the idea "${input.title}" into this discussion. Unique votes and comments have been brought along.`, createdAt: input.now }),
  ] as const;
}
