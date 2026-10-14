import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, MessageSquare, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '~/components/ui/empty';
import { Skeleton } from '~/components/ui/skeleton';
import { useBoard } from '~/components/board-context';
import { initials, relativeDate, statusLabels, type BoardSearch, type FeedbackStatus, type Post, type Tag } from '~/lib/feedback';
import { setVote } from '~/lib/feedback.functions';
import { plainText } from '~/lib/rich-text';
import { cn } from '~/lib/utils';

// Class names stay literal so Tailwind can find them.
export const statusDot: Record<FeedbackStatus, string> = {
  open: 'bg-zinc-400',
  planned: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  completed: 'bg-emerald-500',
  closed: 'bg-rose-500'
};

const statusBadge: Record<FeedbackStatus, string> = {
  open: 'bg-muted text-muted-foreground',
  planned: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  in_progress: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
};

export const tagDot: Record<string, string> = {
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  green: 'bg-emerald-500',
  gray: 'bg-zinc-400'
};

const avatarTones = [
  'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
];

export function Dot({ className }: { className?: string }) {
  return <span aria-hidden='true' className={cn('size-2 shrink-0 rounded-full', className)} />;
}

export function StatusBadge({ status, className }: { status: FeedbackStatus; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap', statusBadge[status], className)}>
      <Dot className={cn('size-1.5', statusDot[status])} />
      {statusLabels[status]}
    </span>
  );
}

export function TagLabel({ tag }: { tag: Tag }) {
  return (
    <span className='inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground'>
      <Dot className={cn('size-1.5', tagDot[tag.color] ?? tagDot.gray)} />
      {tag.name}
    </span>
  );
}

export function UserAvatar({ name, size = 'sm', className, title }: { name: string; size?: 'sm' | 'default' | 'lg'; className?: string; title?: string }) {
  const tone = avatarTones[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarTones.length];
  return (
    <Avatar size={size} className={className} title={title}>
      <AvatarFallback className={cn('font-medium', size === 'sm' && 'text-[10px]', tone)}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function VoteButton({ post, size = 'default' }: { post: Post; size?: 'default' | 'sm' }) {
  const { requireUser } = useBoard();
  const client = useQueryClient();
  const vote = useMutation({
    mutationFn: (voted: boolean) => setVote({ data: { id: post.id, voted } }),
    // Returning the refetch keeps the optimistic state until fresh counts arrive.
    onSuccess: () => client.invalidateQueries({ queryKey: ['wishbox'] }),
    onError: (error) => toast.error(error.message)
  });
  const voted = vote.isPending ? vote.variables : post.voted;
  const count = post.voteCount + (voted === post.voted ? 0 : voted ? 1 : -1);
  const locked = post.status === 'closed' || !!post.mergedIntoId;
  return (
    <button
      type='button'
      aria-pressed={voted}
      aria-label={`${voted ? 'Remove vote' : 'Upvote'} (${count} ${count === 1 ? 'vote' : 'votes'})`}
      title={locked ? 'Voting is closed' : undefined}
      disabled={locked}
      onClick={() => requireUser(() => { if (!vote.isPending) vote.mutate(!post.voted); })}
      className={cn(
        'relative z-10 shrink-0 border font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'default' ? 'flex h-14 w-12 flex-col items-center justify-center rounded-lg text-sm' : 'inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs',
        voted ? 'border-primary/30 bg-primary/10 text-primary' : 'bg-card hover:border-primary/40 hover:text-primary disabled:hover:border-border disabled:hover:text-foreground'
      )}
    >
      <ChevronUp className={size === 'default' ? 'size-4' : 'size-3.5'} strokeWidth={2.5} />
      {count}
    </button>
  );
}

export function PostRow({ post, search }: { post: Post; search?: BoardSearch }) {
  const { project } = useBoard();
  return (
    <li className='relative flex gap-4 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-5'>
      <VoteButton post={post} />
      <div className='min-w-0 flex-1'>
        <Link
          to='/p/$slug/ideas/$postId'
          params={{ slug: project.slug, postId: post.id }}
          search={search}
          className='font-medium leading-snug outline-none after:absolute after:inset-0 focus-visible:underline'
        >
          {post.title}
        </Link>
        <p className='mt-1 line-clamp-2 text-sm text-muted-foreground'>{plainText(post.description)}</p>
        <div className='mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground'>
          {post.status !== 'open' && <StatusBadge status={post.status} />}
          {post.tags.map((tag) => <TagLabel key={tag.id} tag={tag} />)}
          <span className='inline-flex items-center gap-1' aria-label={`${post.commentCount} comments`}>
            <MessageSquare className='size-3.5' />
            {post.commentCount}
          </span>
          <span className='truncate'>{post.authorName} · {relativeDate(post.createdAt)}</span>
        </div>
      </div>
    </li>
  );
}

export function PostListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul aria-label='Loading ideas' className='divide-y'>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className='flex gap-4 px-4 py-4 sm:px-5'>
          <Skeleton className='h-14 w-12 rounded-lg' />
          <div className='flex-1 space-y-2 pt-0.5'>
            <Skeleton className='h-4 w-2/3' />
            <Skeleton className='h-3.5 w-full' />
            <Skeleton className='h-3.5 w-1/3' />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ icon, title, description, children }: { icon?: ReactNode; title: string; description?: string; children?: ReactNode }) {
  return (
    <Empty className='py-14'>
      <EmptyHeader>
        {icon && <EmptyMedia variant='icon'>{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}

export function ErrorState({ message, retry }: { message?: string; retry: () => void }) {
  return (
    <EmptyState icon={<TriangleAlert />} title='Something went wrong' description={message}>
      <Button variant='outline' size='sm' onClick={retry}>Try again</Button>
    </EmptyState>
  );
}
