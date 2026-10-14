import { useDeferredValue, useState, type ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, Plus, Search, SearchX, X } from 'lucide-react';
import { Dot, EmptyState, ErrorState, PostListSkeleton, PostRow, statusDot, tagDot } from '~/components/feedback-ui';
import { useBoard } from '~/components/board-context';
import { Button } from '~/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '~/components/ui/input-group';
import { NativeSelect, NativeSelectOption } from '~/components/ui/native-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { selectPosts, statusLabels, statuses, validateBoardSearch, type BoardSearch, type Post } from '~/lib/feedback';
import { boardQuery } from '~/lib/queries';
import { cn } from '~/lib/utils';
import { seo } from '~/utils/seo';

const pageSize = 10;
const sortLabels = { votes: 'Top', trending: 'Trending', newest: 'Newest' } as const;

export const Route = createFileRoute('/p/$slug/')({
  validateSearch: validateBoardSearch,
  loader: async ({ context, params }) => ({ name: (await context.queryClient.ensureQueryData(boardQuery(params.slug)))?.project.name }),
  head: ({ loaderData }) => ({ meta: seo({ title: `Feedback | ${loaderData?.name ?? 'Wishbox'}` }) }),
  component: Board
});

function Board() {
  const { project, viewer, openAuth, openCreate } = useBoard();
  const board = useQuery(boardQuery(project.slug));
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const [visible, setVisible] = useState(pageSize);
  const query = filters.q ?? '';
  const search = useDeferredValue(query);
  const status = filters.status ?? 'all';
  const tag = filters.tag ?? '';
  const sort = filters.sort ?? 'votes';
  const update = (next: BoardSearch) => {
    setVisible(pageSize);
    void navigate({ search: (previous) => ({ ...previous, ...next }), replace: true, resetScroll: false });
  };
  const clear = () => update({ q: undefined, status: undefined, tag: undefined });

  const posts = board.data?.posts ?? [];
  const tags = board.data?.tags ?? [];
  const filtered = selectPosts(posts, { search, status, tag, sort, userId: viewer?.id });
  const filtering = status !== 'all' || !!tag || !!query;
  const count = (match: (post: Post) => boolean) => posts.filter(match).length;

  return (
    <div className='grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10'>
      <aside className='hidden lg:block'>
        <nav aria-label='Filters' className='sticky top-24 grid gap-6'>
          <FilterGroup>
            <FilterItem active={status === 'all'} count={posts.length} onClick={() => update({ status: undefined })}>All ideas</FilterItem>
            {viewer && <FilterItem active={status === 'mine'} count={count((post) => post.authorId === viewer.id)} onClick={() => update({ status: 'mine' })}>My ideas</FilterItem>}
          </FilterGroup>
          <FilterGroup label='Status'>
            {statuses.map((item) => (
              <FilterItem key={item} dot={statusDot[item]} active={status === item} count={count((post) => post.status === item)} onClick={() => update({ status: item })}>
                {statusLabels[item]}
              </FilterItem>
            ))}
          </FilterGroup>
          {tags.length > 0 && (
            <FilterGroup label='Categories'>
              {tags.map((item) => (
                <FilterItem
                  key={item.id}
                  dot={tagDot[item.color] ?? tagDot.gray}
                  active={tag === item.id}
                  count={count((post) => post.tags.some((postTag) => postTag.id === item.id))}
                  onClick={() => update({ tag: tag === item.id ? undefined : item.id })}
                >
                  {item.name}
                </FilterItem>
              ))}
            </FilterGroup>
          )}
        </nav>
      </aside>

      <section className='min-w-0'>
        <h1 className='text-2xl font-semibold tracking-tight'>Feedback</h1>
        <p className='mt-1 text-sm text-muted-foreground'>{project.description || 'Share ideas and vote on what gets built next.'}</p>

        <div className='mt-6 flex gap-2'>
          <InputGroup className='flex-1 bg-card'>
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput aria-label='Search ideas' placeholder='Search ideas' value={query} onChange={(e) => update({ q: e.target.value || undefined })} />
            {query && (
              <InputGroupAddon align='inline-end'>
                <InputGroupButton size='icon-xs' aria-label='Clear search' onClick={() => update({ q: undefined })}><X /></InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <Select value={sort} onValueChange={(value) => update({ sort: value === 'votes' ? undefined : (value as BoardSearch['sort']) })}>
            <SelectTrigger aria-label='Sort ideas' className='w-28 bg-card sm:w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align='end'>
              {Object.entries(sortLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className='mt-2 grid grid-cols-2 gap-2 lg:hidden'>
          <NativeSelect aria-label='Filter by status' className='w-full rounded-md bg-card' value={status} onChange={(e) => update({ status: e.target.value === 'all' ? undefined : (e.target.value as BoardSearch['status']) })}>
            <NativeSelectOption value='all'>All statuses</NativeSelectOption>
            {viewer && <NativeSelectOption value='mine'>My ideas</NativeSelectOption>}
            {statuses.map((item) => <NativeSelectOption key={item} value={item}>{statusLabels[item]}</NativeSelectOption>)}
          </NativeSelect>
          <NativeSelect aria-label='Filter by category' className='w-full rounded-md bg-card' value={tag} onChange={(e) => update({ tag: e.target.value || undefined })}>
            <NativeSelectOption value=''>All categories</NativeSelectOption>
            {tags.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
          </NativeSelect>
        </div>

        {filtering && !board.isLoading && (
          <div className='mt-4 flex items-center gap-2 text-sm text-muted-foreground'>
            <span>{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span>
            <span aria-hidden='true'>·</span>
            <button type='button' onClick={clear} className='font-medium text-foreground hover:underline'>Clear filters</button>
          </div>
        )}

        <div className='mt-4 overflow-hidden rounded-xl border bg-card shadow-xs' aria-busy={board.isLoading}>
          {board.isLoading ? (
            <PostListSkeleton />
          ) : board.error ? (
            <ErrorState message='The board could not be loaded.' retry={() => void board.refetch()} />
          ) : filtered.length ? (
            <ul className='divide-y'>
              {filtered.slice(0, visible).map((post) => <PostRow key={post.id} post={post} search={filters} />)}
            </ul>
          ) : status === 'mine' && !viewer ? (
            <EmptyState icon={<Lightbulb />} title='Sign in to see your ideas'>
              <Button size='sm' onClick={openAuth}>Sign in</Button>
            </EmptyState>
          ) : !posts.length || (status === 'mine' && !tag && !query) ? (
            <EmptyState icon={<Lightbulb />} title={posts.length ? 'You haven’t posted any ideas yet' : 'No ideas yet'} description={posts.length ? undefined : 'Be the first to share one.'}>
              <Button size='sm' onClick={openCreate}><Plus />New idea</Button>
            </EmptyState>
          ) : (
            <EmptyState icon={<SearchX />} title='No matching ideas'>
              <Button variant='outline' size='sm' onClick={clear}>Clear filters</Button>
            </EmptyState>
          )}
        </div>
        {filtered.length > visible && (
          <Button variant='outline' className='mt-4 w-full bg-card' onClick={() => setVisible((value) => value + pageSize)}>
            Show more
          </Button>
        )}
      </section>
    </div>
  );
}

function FilterGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className='grid gap-0.5'>
      {label && <h2 className='mb-1 px-2 text-xs font-medium text-muted-foreground'>{label}</h2>}
      {children}
    </div>
  );
}

function FilterItem({ active, count, dot, onClick, children }: { active: boolean; count: number; dot?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type='button'
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
        active && 'bg-muted font-medium text-foreground'
      )}
    >
      {dot && <Dot className={dot} />}
      <span className='flex-1 truncate'>{children}</span>
      <span className='text-xs text-muted-foreground tabular-nums'>{count}</span>
    </button>
  );
}
