import { plainText } from '~/lib/rich-text';

export const statuses = ['open', 'planned', 'in_progress', 'completed', 'closed'] as const;
export type FeedbackStatus = typeof statuses[number];
export const statusLabels: Record<FeedbackStatus, string> = {
  open: 'Open', planned: 'Planned', in_progress: 'In progress', completed: 'Completed', closed: 'Closed',
};
export type Tag = { id: string; name: string; color: string };
export type Post = {
  id: string; title: string; description: string; authorId: string; authorName: string;
  status: FeedbackStatus; hidden: boolean; mergedIntoId: string | null;
  createdAt: number; updatedAt: number; voteCount: number; commentCount: number;
  voted: boolean; tags: Tag[]; trendingScore: number;
};
export type Project = { id: string; slug: string; name: string; description: string; avatarUrl: string };
export type ProjectRole = 'owner' | 'admin';
/** The sample project linked from the landing page. Its id and slug are both `demo`. */
export const demoSlug = 'demo';
export const boardKey = (slug: string) => ['wishbox', 'board', slug] as const;
export const postKey = (id: string) => ['wishbox', 'post', id] as const;
export const adminKey = (slug: string) => ['wishbox', 'admin', slug] as const;
export const membersKey = (slug: string) => ['wishbox', 'members', slug] as const;
export const projectsKey = ['wishbox', 'projects'] as const;
export type BoardSearch = { q?: string; status?: FeedbackStatus | 'mine'; tag?: string; sort?: 'newest' | 'trending' };
export function validateBoardSearch(search: Record<string, unknown>): BoardSearch {
  return {
    q: typeof search.q === 'string' ? search.q.slice(0, 200) || undefined : undefined,
    status: search.status === 'mine' || statuses.includes(search.status as FeedbackStatus) ? search.status as FeedbackStatus | 'mine' : undefined,
    tag: typeof search.tag === 'string' ? search.tag.slice(0, 100) || undefined : undefined,
    sort: search.sort === 'newest' || search.sort === 'trending' ? search.sort : undefined,
  };
}
export function selectPosts(posts: Post[], filters: { search: string; status: FeedbackStatus | 'all' | 'mine'; tag: string; sort: 'votes' | 'newest' | 'trending'; userId?: string }) {
  const search = filters.search.trim().toLowerCase();
  return posts.filter((post) => (filters.status === 'all' || (filters.status === 'mine' ? post.authorId === filters.userId : post.status === filters.status)) && (!filters.tag || post.tags.some((tag) => tag.id === filters.tag)) && `${post.title} ${plainText(post.description)}`.toLowerCase().includes(search))
    .sort((a, b) => (filters.sort === 'votes' ? b.voteCount - a.voteCount : filters.sort === 'newest' ? b.createdAt - a.createdAt : b.trendingScore - a.trendingScore) || b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}
export function validateText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new Error(`${label} must be between ${min} and ${max} characters.`);
  return value.trim();
}
export function validateId(input: unknown) {
  const data = input as Record<string, unknown> | null;
  if (!data) throw new Error('Missing request.');
  return { id: validateText(data.id, 'Post ID', 1, 100) };
}
export function validatePost(input: unknown) {
  const data = input as Record<string, unknown>;
  if (!data) throw new Error('Missing request.');
  return { title: validateText(data.title, 'Title', 5, 160), description: validateText(data.description, 'Description', 15, 5000), tagId: data.tagId ? validateText(data.tagId, 'Tag', 1, 100) : '' };
}
export function validateVote(input: unknown) {
  const { id } = validateId(input);
  const voted = (input as Record<string, unknown>).voted;
  if (typeof voted !== 'boolean') throw new Error('Invalid vote.');
  return { id, voted };
}
export function validateUpdate(input: unknown) {
  const data = input as Record<string, unknown>;
  const { id } = validateId(input);
  const status = data.status as FeedbackStatus;
  if (!statuses.includes(status)) throw new Error('Invalid status.');
  if (typeof data.hidden !== 'boolean') throw new Error('Invalid visibility.');
  if (!Array.isArray(data.tagIds) || data.tagIds.length > 10) throw new Error('Choose up to ten tags.');
  return { id, title: validateText(data.title, 'Title', 5, 160), description: validateText(data.description, 'Description', 15, 5000), status, hidden: data.hidden, tagIds: [...new Set(data.tagIds.map((id) => validateText(id, 'Tag', 1, 100)))], message: data.message ? validateText(data.message, 'Update', 2, 2000) : '' };
}
// Slugs name public boards at /p/<slug>. These would read as product pages.
const reservedSlugs = new Set(['admin', 'api', 'app', 'dashboard', 'demo', 'new', 'settings', 'www']);
export function slugify(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
}
export function validateSlug(value: unknown) {
  const slug = validateText(value, 'Link', 3, 40);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Use lowercase letters, numbers, and single dashes.');
  if (reservedSlugs.has(slug)) throw new Error('This link is reserved. Choose another one.');
  return slug;
}
export function validateSlugInput(input: unknown) {
  return { slug: validateText((input as Record<string, unknown> | null)?.slug, 'Project', 1, 40) };
}
export function validateProject(input: unknown) {
  const data = input as Record<string, unknown> | null;
  if (!data) throw new Error('Missing request.');
  return {
    name: validateText(data.name, 'Name', 2, 60),
    description: typeof data.description === 'string' ? validateText(data.description, 'Description', 0, 200) : '',
    avatarUrl: typeof data.avatarUrl === 'string' ? validateImageUrl(data.avatarUrl) : ''
  };
}
/** An empty string, or an absolute http(s) URL. Other schemes could run script when rendered. */
export function validateImageUrl(value: string) {
  const url = validateText(value, 'Avatar URL', 0, 500);
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) throw new Error('Avatar URL must start with https:// or http://.');
  return url;
}
export function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}
export function shortDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function relativeDate(timestamp: number) {
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  return days === 0 ? 'today' : days === 1 ? '1 day ago' : days < 30 ? `${days} days ago` : shortDate(timestamp);
}
export const tagColors = ['blue', 'violet', 'orange', 'pink', 'green', 'gray'] as const;
export function validateTag(input: unknown) {
  const data = input as Record<string, unknown> | null;
  const color = validateText(data?.color, 'Color', 1, 20);
  if (!tagColors.includes(color as typeof tagColors[number])) throw new Error('Choose an available color.');
  return { name: validateText(data?.name, 'Tag name', 2, 32), color };
}
const commonWords = new Set(['about', 'add', 'allow', 'also', 'better', 'could', 'from', 'have', 'into', 'like', 'make', 'more', 'need', 'please', 'should', 'some', 'that', 'their', 'there', 'this', 'when', 'with', 'would', 'your']);
function keywords(text: string) {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter((word) => !commonWords.has(word)) ?? []);
}
/** Existing ideas whose titles share keywords with a draft title, best match first. */
export function findSimilar(posts: Post[], title: string, limit = 3) {
  const draft = keywords(title);
  if (!draft.size) return [];
  return posts
    .map((post) => ({ post, score: [...keywords(post.title)].filter((word) => draft.has(word)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.post.voteCount - a.post.voteCount)
    .slice(0, limit)
    .map(({ post }) => post);
}
