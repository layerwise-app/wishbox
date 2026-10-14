import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { useBoard } from '~/components/board-context';
import { Dot, ErrorState, TagLabel, VoteButton, statusDot } from '~/components/feedback-ui';
import { Skeleton } from '~/components/ui/skeleton';
import { statusLabels, type Post } from '~/lib/feedback';
import { boardQuery } from '~/lib/queries';
import { seo } from '~/utils/seo';

const columns = ['planned', 'in_progress', 'completed'] as const;

export const Route = createFileRoute('/p/$slug/roadmap')({
  loader: async ({ context, params }) => ({ name: (await context.queryClient.ensureQueryData(boardQuery(params.slug)))?.project.name }),
  head: ({ loaderData }) => ({ meta: seo({ title: `Roadmap | ${loaderData?.name ?? 'Wishbox'}`, description: 'What’s planned, in progress, and shipped.' }) }),
  component: Roadmap
});

function Roadmap() {
  const { project } = useBoard();
  const board = useQuery(boardQuery(project.slug));
  return (
    <div>
      <h1 className='text-2xl font-semibold tracking-tight'>Roadmap</h1>
      {board.error ? (
        <div className='mt-6 rounded-xl border bg-card'>
          <ErrorState message='The roadmap could not be loaded.' retry={() => void board.refetch()} />
        </div>
      ) : (
        <div className='mt-6 grid items-start gap-4 md:grid-cols-3'>
          {columns.map((status) => {
            const posts = (board.data?.posts ?? [])
              .filter((post) => post.status === status)
              // Shipped work reads newest first; everything else by demand.
              .sort((a, b) => (status === 'completed' ? b.updatedAt - a.updatedAt : b.voteCount - a.voteCount));
            return (
              <section key={status} className='rounded-xl bg-muted/60 p-2 dark:bg-muted/30' aria-labelledby={`column-${status}`}>
                <h2 id={`column-${status}`} className='flex h-9 items-center gap-2 px-2 text-sm font-medium'>
                  <Dot className={statusDot[status]} />
                  {statusLabels[status]}
                  <span className='ml-auto text-xs font-normal text-muted-foreground tabular-nums'>{board.data ? posts.length : ''}</span>
                </h2>
                <ul className='grid gap-2'>
                  {board.isLoading ? (
                    Array.from({ length: 3 }, (_, index) => <li key={index}><Skeleton className='h-20 rounded-lg bg-card' /></li>)
                  ) : posts.length ? (
                    posts.map((post) => <RoadmapCard key={post.id} post={post} />)
                  ) : (
                    <li className='rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground'>Nothing here yet</li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoadmapCard({ post }: { post: Post }) {
  const { project } = useBoard();
  return (
    <li className='relative rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:border-foreground/20'>
      <Link
        to='/p/$slug/ideas/$postId'
        params={{ slug: project.slug, postId: post.id }}
        className='text-sm leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/50'
      >
        {post.title}
      </Link>
      {post.tags.length > 0 && (
        <div className='mt-2 flex flex-wrap gap-x-3 gap-y-1'>
          {post.tags.map((tag) => <TagLabel key={tag.id} tag={tag} />)}
        </div>
      )}
      <div className='mt-3 flex items-center gap-3 text-xs text-muted-foreground'>
        <VoteButton post={post} size='sm' />
        <span className='inline-flex items-center gap-1' aria-label={`${post.commentCount} comments`}>
          <MessageSquare className='size-3.5' />
          {post.commentCount}
        </span>
      </div>
    </li>
  );
}
