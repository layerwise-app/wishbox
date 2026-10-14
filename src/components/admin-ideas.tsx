import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Eye, EyeOff, GitMerge, Inbox, MoreHorizontal, Pencil, Search, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { Dot, EmptyState, ErrorState, PostListSkeleton, TagLabel, statusDot } from '~/components/feedback-ui';
import { PostEditor, useQuickUpdate } from '~/components/post-editor';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import { findSimilar, shortDate, statusLabels, statuses, type FeedbackStatus, type Post } from '~/lib/feedback';
import { mergePosts } from '~/lib/feedback.functions';
import { adminQuery } from '~/lib/queries';

const views = { public: 'Public', hidden: 'Hidden', merged: 'Merged' } as const;
type View = keyof typeof views;

const inView = (post: Post, view: View) => (view === 'merged' ? !!post.mergedIntoId : !post.mergedIntoId && post.hidden === (view === 'hidden'));

export function AdminIdeas({ slug }: { slug: string }) {
  const query = useQuery(adminQuery(slug));
  const [view, setView] = useState<View>('public');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Post | null>(null);
  const [merging, setMerging] = useState<Post | null>(null);
  const posts = query.data?.posts ?? [];
  const term = search.trim().toLowerCase();
  const rows = posts.filter((post) => inView(post, view) && `${post.title} ${post.authorName}`.toLowerCase().includes(term));
  const titles = new Map(posts.map((post) => [post.id, post.title]));

  return (
    <div className='grid gap-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <ToggleGroup type='single' variant='outline' value={view} onValueChange={(value) => value && setView(value as View)} className='bg-card'>
          {Object.entries(views).map(([value, label]) => (
            <ToggleGroupItem key={value} value={value} className='px-3'>
              {label}
              <span className='text-xs text-muted-foreground tabular-nums'>{posts.filter((post) => inView(post, value as View)).length}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <InputGroup className='bg-card sm:ml-auto sm:w-64'>
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput aria-label='Search ideas' placeholder='Search title or author' value={search} onChange={(e) => setSearch(e.target.value)} />
        </InputGroup>
      </div>

      <div className='overflow-hidden rounded-xl border bg-card shadow-xs'>
        {query.isLoading ? (
          <PostListSkeleton rows={3} />
        ) : query.error ? (
          <ErrorState message={query.error.message} retry={() => void query.refetch()} />
        ) : rows.length ? (
          <Table className='min-w-[42rem]'>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='pl-4'>Idea</TableHead>
                <TableHead className='w-44'>{view === 'merged' ? 'Merged into' : 'Status'}</TableHead>
                <TableHead className='w-16 text-right'>Votes</TableHead>
                <TableHead className='w-24 text-right'>Comments</TableHead>
                <TableHead className='w-24'>Created</TableHead>
                <TableHead className='w-12' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className='max-w-0 py-3 pl-4'>
                    <Link to='/p/$slug/ideas/$postId' params={{ slug, postId: post.id }} className='block truncate font-medium hover:underline'>{post.title}</Link>
                    <div className='mt-0.5 flex items-center gap-3 overflow-hidden text-xs text-muted-foreground'>
                      <span className='truncate'>{post.authorName}</span>
                      {post.tags.map((tag) => <TagLabel key={tag.id} tag={tag} />)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {post.mergedIntoId ? (
                      <Link to='/p/$slug/ideas/$postId' params={{ slug, postId: post.mergedIntoId }} className='block max-w-40 truncate text-muted-foreground hover:text-foreground hover:underline'>
                        {titles.get(post.mergedIntoId) ?? 'Another idea'}
                      </Link>
                    ) : (
                      <StatusSelect post={post} />
                    )}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>{post.voteCount}</TableCell>
                  <TableCell className='text-right tabular-nums'>{post.commentCount}</TableCell>
                  <TableCell className='text-muted-foreground'>{shortDate(post.createdAt)}</TableCell>
                  <TableCell className='pr-3'>
                    <RowActions slug={slug} post={post} onEdit={() => setEditing(post)} onMerge={() => setMerging(post)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : term ? (
          <EmptyState icon={<SearchX />} title='No matching ideas' />
        ) : (
          <EmptyState icon={<Inbox />} title={view === 'public' ? 'No ideas yet' : `No ${view} ideas`} />
        )}
      </div>

      {editing && <PostEditor key={editing.id} post={editing} tags={query.data?.tags ?? []} admin onClose={() => setEditing(null)} />}
      {merging && <MergeDialog key={merging.id} post={merging} posts={posts} onClose={() => setMerging(null)} />}
    </div>
  );
}

function StatusSelect({ post }: { post: Post }) {
  const update = useQuickUpdate();
  return (
    <Select value={post.status} disabled={update.isPending} onValueChange={(status) => update.mutate({ post, status: status as FeedbackStatus })}>
      <SelectTrigger size='sm' aria-label={`Status of ${post.title}`} className='w-36'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => (
          <SelectItem key={status} value={status}>
            <Dot className={statusDot[status]} />
            {statusLabels[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RowActions({ slug, post, onEdit, onMerge }: { slug: string; post: Post; onEdit: () => void; onMerge: () => void }) {
  const update = useQuickUpdate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon-sm' aria-label={`Actions for ${post.title}`}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-44'>
        <DropdownMenuItem asChild>
          <Link to='/p/$slug/ideas/$postId' params={{ slug, postId: post.id }}><ArrowUpRight />Open</Link>
        </DropdownMenuItem>
        {!post.mergedIntoId && (
          <>
            <DropdownMenuItem onSelect={onEdit}><Pencil />Edit</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => update.mutate({ post, hidden: !post.hidden }, { onSuccess: () => toast.success(post.hidden ? 'Idea is public' : 'Idea hidden') })}>
              {post.hidden ? <Eye /> : <EyeOff />}
              {post.hidden ? 'Show on board' : 'Hide from board'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onMerge}><GitMerge />Merge into…</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MergeDialog({ post, posts, onClose }: { post: Post; posts: Post[]; onClose: () => void }) {
  const [target, setTarget] = useState('');
  const client = useQueryClient();
  const merge = useMutation({
    mutationFn: () => mergePosts({ data: { id: post.id, targetId: target } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Ideas merged');
      onClose();
    }
  });
  const candidates = posts.filter((item) => !item.hidden && !item.mergedIntoId && item.id !== post.id);
  const suggested = findSimilar(candidates, post.title);
  const rest = candidates.filter((item) => !suggested.includes(item)).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold'>Merge idea</DialogTitle>
          <DialogDescription>Votes and comments from “{post.title}” move into the idea you choose. This can’t be undone.</DialogDescription>
        </DialogHeader>
        <Field className='gap-2'>
          <FieldLabel htmlFor='merge-target'>Merge into</FieldLabel>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id='merge-target' className='w-full'>
              <SelectValue placeholder='Choose an idea' />
            </SelectTrigger>
            <SelectContent className='max-h-72'>
              {suggested.length > 0 && (
                <>
                  <SelectGroup>
                    <SelectLabel>Similar</SelectLabel>
                    {suggested.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                  </SelectGroup>
                  {rest.length > 0 && <SelectSeparator />}
                </>
              )}
              {rest.length > 0 && (
                <SelectGroup>
                  {suggested.length > 0 && <SelectLabel>All ideas</SelectLabel>}
                  {rest.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          {merge.error && <FieldError>{merge.error.message}</FieldError>}
        </Field>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>Cancel</Button>
          <Button disabled={!target || merge.isPending} onClick={() => merge.mutate()}>
            {merge.isPending && <Spinner />}
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
