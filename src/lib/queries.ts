import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { adminKey, boardKey, membersKey, postKey, projectsKey } from '~/lib/feedback';
import { getAdminBoard, getBoard, getPost } from '~/lib/feedback.functions';
import { getMembers, listProjects } from '~/lib/project.functions';

export const boardQuery = (slug: string) => queryOptions({ queryKey: boardKey(slug), queryFn: () => getBoard({ data: { slug } }) });

export const postQuery = (slug: string, id: string) =>
  queryOptions({
    queryKey: postKey(id),
    queryFn: () => getPost({ data: { slug, id } }),
    // The loader just fetched it; skip the immediate refetch on mount.
    staleTime: 10_000
  });

export const adminQuery = (slug: string) => queryOptions({ queryKey: adminKey(slug), queryFn: () => getAdminBoard({ data: { slug } }) });

export const projectsQuery = queryOptions({ queryKey: projectsKey, queryFn: () => listProjects() });

export const membersQuery = (slug: string) => queryOptions({ queryKey: membersKey(slug), queryFn: () => getMembers({ data: { slug } }) });

/** After signing in or out: drop data only the team could see, then refetch the rest. */
export async function refreshAfterAuth(client: QueryClient) {
  for (const key of [['wishbox', 'admin'], ['wishbox', 'members'], projectsKey]) client.removeQueries({ queryKey: key });
  await client.invalidateQueries({ queryKey: ['wishbox'] });
}
