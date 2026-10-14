import { createFileRoute, notFound, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { NotFound } from '~/components/NotFound';
import { PublicShell } from '~/components/public-shell';
import { boardQuery } from '~/lib/queries';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/p/$slug')({
  loader: async ({ context, params }) => {
    const board = await context.queryClient.ensureQueryData(boardQuery(params.slug));
    if (!board) throw notFound();
    return { name: board.project.name, description: board.project.description, avatarUrl: board.project.avatarUrl };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? seo({ title: loaderData.name, description: loaderData.description || undefined }) : [],
    // Comes after the root icon, so the board shows the project's avatar in the tab.
    links: loaderData?.avatarUrl ? [{ rel: 'icon', href: loaderData.avatarUrl }] : []
  }),
  notFoundComponent: BoardNotFound,
  component: PublicBoard
});

function PublicBoard() {
  const { slug } = Route.useParams();
  const { data } = useQuery(boardQuery(slug));
  // The loader guarantees a board; it disappears only if the project is deleted while open.
  if (!data) return <BoardNotFound />;
  return (
    <PublicShell project={data.project} role={data.role} demo={data.demo}>
      <Outlet />
    </PublicShell>
  );
}

function BoardNotFound() {
  return <NotFound title='Board not found'>No board uses this link.</NotFound>;
}
