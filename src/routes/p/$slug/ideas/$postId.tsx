import { useRef, useState, type ReactNode } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, EyeOff, GitMerge, Pencil, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Dot, ErrorState, StatusBadge, TagLabel, UserAvatar, VoteButton, statusDot } from '~/components/feedback-ui';
import { PostEditor, useQuickUpdate } from '~/components/post-editor';
import { RichText, RichTextEditor } from '~/components/rich-text-editor';
import { useBoard } from '~/components/board-context';
import { Alert, AlertDescription } from '~/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '~/components/ui/alert-dialog';
import { AvatarGroup, AvatarGroupCount } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { Spinner } from '~/components/ui/spinner';
import { relativeDate, statusLabels, statuses, validateBoardSearch, type FeedbackStatus } from '~/lib/feedback';
import { addComment, removeComment, type getPost } from '~/lib/feedback.functions';
import { boardQuery, postQuery } from '~/lib/queries';
import { plainText } from '~/lib/rich-text';
import { cn } from '~/lib/utils';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/p/$slug/ideas/$postId')({
  validateSearch: validateBoardSearch,
  loader: async ({ context, params }) => {
    const [{ post }, board] = await Promise.all([
      context.queryClient.ensureQueryData(postQuery(params.slug, params.postId)),
      context.queryClient.ensureQueryData(boardQuery(params.slug))
    ]);
    return { title: post.title, name: board?.project.name ?? 'Wishbox' };
  },
  head: ({ loaderData }) => ({ meta: seo({ title: loaderData ? `${loaderData.title} | ${loaderData.name}` : 'Wishbox' }) }),
  pendingComponent: DetailSkeleton,
  component: IdeaPage
});

type Detail = Awaited<ReturnType<typeof getPost>>;
type Entry =
  | ({ kind: 'comment' } & Detail['discussion'][number])
  | ({ kind: 'status' } & Detail['updates'][number]);

function IdeaPage() {
  const { slug, postId } = Route.useParams();
  const boardSearch = Route.useSearch();
  const detail = useQuery(postQuery(slug, postId));
  const board = useQuery(boardQuery(slug));
  const { viewer, role } = useBoard();
  const [editing, setEditing] = useState(false);

  const back = (
    <Link to='/p/$slug' params={{ slug }} search={boardSearch} className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground'>
      <ArrowLeft className='size-4' />
      All ideas
    </Link>
  );
  if (!detail.data) {
    return (
      <div className='grid gap-6'>
        {back}
        {detail.error ? <ErrorState message={detail.error.message} retry={() => void detail.refetch()} /> : <DetailSkeleton />}
      </div>
    );
  }

  const { post, discussion, updates, voters } = detail.data;
  const admin = !!role;
  const canEdit = !post.mergedIntoId && (viewer?.id === post.authorId || admin);
  const mergedInto = post.mergedIntoId ? board.data?.posts.find((item) => item.id === post.mergedIntoId) : undefined;
  const entries: Entry[] = [
    ...discussion.map((comment) => ({ kind: 'comment' as const, ...comment })),
    ...updates.map((update) => ({ kind: 'status' as const, ...update }))
  ].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div className='grid gap-6'>
      {back}
      <div className='grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14'>
        <article className='min-w-0'>
          <header className='flex items-start gap-4'>
            <VoteButton post={post} />
            <div className='min-w-0 flex-1'>
              <h1 className='text-xl font-semibold tracking-tight text-balance sm:text-2xl'>{post.title}</h1>
              <div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground'>
                <span className='inline-flex items-center gap-2'>
                  <UserAvatar name={post.authorName} />
                  <span className='text-foreground'>{post.authorName}</span>
                </span>
                <span>{relativeDate(post.createdAt)}</span>
                <StatusBadge status={post.status} />
                {post.tags.map((tag) => <TagLabel key={tag.id} tag={tag} />)}
              </div>
            </div>
            {canEdit && (
              <Button variant='outline' size='sm' onClick={() => setEditing(true)}>
                <Pencil />
                <span className='hidden sm:inline'>Edit</span>
              </Button>
            )}
          </header>

          {post.mergedIntoId && (
            <Alert className='mt-6'>
              <GitMerge />
              <AlertDescription>
                <p>
                  Merged into{' '}
                  <Link to='/p/$slug/ideas/$postId' params={{ slug, postId: post.mergedIntoId }} className='font-medium text-foreground underline underline-offset-4'>
                    {mergedInto?.title ?? 'another idea'}
                  </Link>
                  . Votes and comments moved there.
                </p>
              </AlertDescription>
            </Alert>
          )}
          {post.hidden && (
            <Alert className='mt-6'>
              <EyeOff />
              <AlertDescription>Hidden from the board. Only the team can see this idea.</AlertDescription>
            </Alert>
          )}

          <RichText value={post.description} className='mt-6 text-[15px] leading-7' />

          <section className='mt-12' aria-labelledby='activity'>
            <h2 id='activity' className='mb-5 text-sm font-semibold'>Activity</h2>
            {entries.length > 0 && (
              <ol className='mb-8 grid gap-6'>
                {entries.map((entry) => entry.kind === 'comment'
                  ? <CommentEntry key={entry.id} comment={entry} />
                  : <StatusEntry key={entry.id} update={entry} />)}
              </ol>
            )}
            {post.mergedIntoId || post.status === 'closed' ? (
              <p className='rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground'>Comments are closed.</p>
            ) : (
              <CommentForm postId={post.id} />
            )}
          </section>
        </article>

        <aside className='grid content-start gap-8 lg:sticky lg:top-24'>
          <SideSection title={`${post.voteCount} ${post.voteCount === 1 ? 'vote' : 'votes'}`}>
            {voters.length ? (
              <AvatarGroup className='-space-x-0.5'>
                {voters.slice(0, 8).map((voter) => <UserAvatar key={voter.id} name={voter.name} className='bg-background' title={voter.name} />)}
                {post.voteCount > 8 && <AvatarGroupCount className='text-xs'>+{post.voteCount - 8}</AvatarGroupCount>}
              </AvatarGroup>
            ) : (
              <p className='text-sm text-muted-foreground'>No votes yet.</p>
            )}
          </SideSection>
          {admin && !post.mergedIntoId && <AdminControls post={post} />}
        </aside>
      </div>
      {editing && <PostEditor key={post.id} post={post} tags={board.data?.tags ?? []} admin={admin} onClose={() => setEditing(false)} />}
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className='mb-3 text-xs font-medium text-muted-foreground'>{title}</h2>
      {children}
    </section>
  );
}

function AdminControls({ post }: { post: Detail['post'] }) {
  const update = useQuickUpdate();
  return (
    <SideSection title='Manage'>
      <div className='grid gap-2'>
        <Select value={post.status} disabled={update.isPending} onValueChange={(status) => update.mutate({ post, status: status as FeedbackStatus }, { onSuccess: () => toast.success(`Moved to ${statusLabels[status as FeedbackStatus]}`) })}>
          <SelectTrigger aria-label='Status' className='w-full bg-card'><SelectValue /></SelectTrigger>
          <SelectContent>
            {statuses.map((item) => (
              <SelectItem key={item} value={item}>
                <Dot className={statusDot[item]} />
                {statusLabels[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant='outline' className='bg-card' disabled={update.isPending} onClick={() => update.mutate({ post, hidden: !post.hidden }, { onSuccess: () => toast.success(post.hidden ? 'Idea is public' : 'Idea hidden') })}>
          {post.hidden ? 'Show on board' : 'Hide from board'}
        </Button>
      </div>
    </SideSection>
  );
}

function CommentEntry({ comment }: { comment: Extract<Entry, { kind: 'comment' }> }) {
  const { viewer, role } = useBoard();
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeComment({ data: { id: comment.id } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Comment deleted');
    },
    onError: (error) => toast.error(error.message)
  });
  const canRemove = !comment.hidden && (viewer?.id === comment.authorId || !!role);
  return (
    <li className={cn('flex gap-3', comment.hidden && 'opacity-50')}>
      <UserAvatar name={comment.authorName} size='default' />
      <div className='min-w-0 flex-1'>
        <div className='flex h-8 items-center gap-2 text-sm'>
          <span className='truncate font-medium'>{comment.authorName}</span>
          {comment.team && <Badge variant='secondary' className='h-4.5 px-1.5 text-[11px]'>Team</Badge>}
          <span className='shrink-0 text-muted-foreground'>{relativeDate(comment.createdAt)}</span>
          {comment.hidden && <Badge variant='outline' className='h-4.5 px-1.5 text-[11px]'>Deleted</Badge>}
          {canRemove && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant='ghost' size='icon-xs' className='ml-auto text-muted-foreground' aria-label={`Delete comment by ${comment.authorName}`}>
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent size='sm'>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                  <AlertDialogDescription>It will be removed from the discussion.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant='destructive' onClick={() => remove.mutate()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <RichText value={comment.body} className='text-sm leading-6' />
      </div>
    </li>
  );
}

function StatusEntry({ update }: { update: Extract<Entry, { kind: 'status' }> }) {
  const status = update.status as FeedbackStatus;
  // Updates saved without a note store this generated sentence; the badge already says it.
  const note = update.message === `Moved to ${status.replace('_', ' ')}.` ? '' : update.message;
  return (
    <li className='flex gap-3'>
      <span className='flex size-8 shrink-0 items-center justify-center rounded-full border bg-card'>
        <Dot className={statusDot[status]} />
      </span>
      <div className='min-w-0 flex-1'>
        <div className='flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground'>
          <span className='font-medium text-foreground'>{update.authorName}</span>
          <span>changed the status to</span>
          <StatusBadge status={status} />
          <span>{relativeDate(update.createdAt)}</span>
        </div>
        {note && <p className='mt-1 rounded-lg border bg-card px-3 py-2 text-sm leading-6 whitespace-pre-wrap'>{note}</p>}
      </div>
    </li>
  );
}

function CommentForm({ postId }: { postId: string }) {
  const { viewer, requireUser } = useBoard();
  const [body, setBody] = useState('');
  const client = useQueryClient();
  const comment = useMutation({
    mutationFn: (text: string) => addComment({ data: { id: postId, body: text } }),
    onSuccess: async () => {
      setBody('');
      await client.invalidateQueries({ queryKey: ['wishbox'] });
    },
    onError: (error) => toast.error(error.message)
  });
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      className='flex gap-3'
      onSubmit={(event) => {
        event.preventDefault();
        // Signing in keeps the draft and posts it afterwards.
        requireUser(() => comment.mutate(body));
      }}
    >
      {viewer ? (
        <UserAvatar name={viewer.name} size='default' />
      ) : (
        <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'><UserRound className='size-4' /></span>
      )}
      <div className='grid flex-1 gap-2'>
        <RichTextEditor aria-label='Comment' placeholder='Add a comment' value={body} onChange={setBody} onSubmitShortcut={() => form.current?.requestSubmit()} />
        <div className='flex justify-end'>
          <Button type='submit' size='sm' disabled={comment.isPending || plainText(body).length < 2}>
            {comment.isPending && <Spinner />}
            Comment
          </Button>
        </div>
      </div>
    </form>
  );
}

function DetailSkeleton() {
  return (
    <div className='flex gap-4' aria-label='Loading idea'>
      <Skeleton className='h-14 w-12 rounded-lg' />
      <div className='flex-1 space-y-3 pt-1'>
        <Skeleton className='h-6 w-2/3' />
        <Skeleton className='h-4 w-1/3' />
        <Skeleton className='mt-6 h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
      </div>
    </div>
  );
}
