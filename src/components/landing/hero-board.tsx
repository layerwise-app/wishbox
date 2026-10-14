import { useEffect, useReducer, useRef } from 'react';
import { ChevronUp, MessageSquare } from 'lucide-react';
import { StatusBadge, TagLabel, UserAvatar } from '~/components/feedback-ui';
import type { FeedbackStatus, Tag } from '~/lib/feedback';
import { cn } from '~/lib/utils';

type Idea = { id: string; title: string; votes: number; comments: number; status: FeedbackStatus; tag: Tag; voters: string[] };

const ideas: Idea[] = [
  { id: 'dark', title: 'Dark mode', votes: 50, comments: 12, status: 'in_progress', tag: { id: 'ui', name: 'Design', color: 'violet' }, voters: ['Maya Chen', 'Leo Park', 'Sam Ortiz'] },
  { id: 'slack', title: 'Slack notifications', votes: 47, comments: 8, status: 'planned', tag: { id: 'int', name: 'Integrations', color: 'blue' }, voters: ['Ana Ruiz', 'Tom Hale', 'Ivy Brooks'] },
  { id: 'csv', title: 'Export tasks to CSV', votes: 44, comments: 5, status: 'open', tag: { id: 'data', name: 'Data', color: 'green' }, voters: ['Noah Kim', 'Zoe Hart', 'Eli Moss'] },
  { id: 'keys', title: 'Keyboard shortcuts', votes: 41, comments: 3, status: 'open', tag: { id: 'ux', name: 'Productivity', color: 'orange' }, voters: ['Ava Reed', 'Ben Lee', 'Lia Stone'] }
];

// Each burst lifts one idea past the ones above it. After a full pass every idea has gained
// the same number of votes, so the ranking ends where it started and the loop is seamless.
const bursts = ['keys', 'csv', 'slack', 'dark'];
const votesPerBurst = 4;
const rowHeight = 72;

type Mark = { id: string; n: number };
type Board = { votes: Record<string, number>; order: string[]; n: number; last?: Mark; lift?: Mark };

function reduce(board: Board, id: string): Board {
  const n = board.n + 1;
  const votes = { ...board.votes, [id]: board.votes[id] + 1 };
  // A stable sort keeps tied ideas where they were, so an idea only moves once it pulls ahead.
  const order = [...board.order].sort((a, b) => votes[b] - votes[a]);
  const lift = order.indexOf(id) < board.order.indexOf(id) ? { id, n } : board.lift;
  return { votes, order, n, last: { id, n }, lift };
}

const initial: Board = { votes: Object.fromEntries(ideas.map((idea) => [idea.id, idea.votes])), order: ideas.map((idea) => idea.id), n: 0 };

export function HeroBoard() {
  const ref = useRef<HTMLDivElement>(null);
  const [board, vote] = useReducer(reduce, initial);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let step = 0;
    let timer: number | undefined;
    const tick = () => {
      vote(bursts[Math.floor(step / votesPerBurst) % bursts.length]);
      step += 1;
      timer = window.setTimeout(tick, step % votesPerBurst ? 520 : 1500);
    };
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (entry?.isIntersecting) timer = window.setTimeout(tick, 900);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className='relative'>
      <div className='rounded-2xl border bg-background/60 p-1.5 shadow-2xl shadow-primary/10 ring-1 ring-foreground/[0.03] backdrop-blur-sm sm:p-2'>
        <div className='overflow-hidden rounded-xl border bg-card'>
          <div className='flex h-12 items-center gap-3 border-b px-4 sm:px-5'>
            <span className='text-sm font-semibold'>Top ideas</span>
            <div className='ml-auto flex rounded-lg bg-muted p-0.5 text-xs font-medium text-muted-foreground' aria-hidden='true'>
              <span className='rounded-md bg-card px-2.5 py-1 text-foreground shadow-xs'>Top</span>
              <span className='px-2.5 py-1'>Trending</span>
              <span className='hidden px-2.5 py-1 sm:inline'>Newest</span>
            </div>
          </div>
          {/* Pulled up a pixel so the first row's border sits on the header's. */}
          <ol className='relative -mt-px' style={{ height: rowHeight * ideas.length }} aria-label='Example ideas ranked by votes'>
            {ideas.map((idea) => (
              <Row
                key={idea.id}
                idea={idea}
                votes={board.votes[idea.id]}
                rank={board.order.indexOf(idea.id)}
                pulse={board.last?.id === idea.id ? board.last.n : undefined}
                lift={board.lift?.id === idea.id ? board.lift.n : undefined}
              />
            ))}
          </ol>
        </div>
      </div>

      <div className='landing-float pointer-events-none absolute top-24 -right-48 hidden w-56 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur xl:block' aria-hidden='true'>
        <div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
          <span className='font-medium text-foreground'>Dark mode</span>
          <span className='relative inline-grid'>
            <StatusBadge status='planned' className='landing-status-from col-start-1 row-start-1' />
            <StatusBadge status='in_progress' className='landing-status-to col-start-1 row-start-1' />
          </span>
        </div>
        <p className='mt-2 text-xs leading-relaxed text-muted-foreground'>Design is done. Rolling out next week.</p>
      </div>

      <div className='landing-float pointer-events-none absolute -bottom-10 -left-52 hidden w-56 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur xl:block' style={{ animationDelay: '-3s' }} aria-hidden='true'>
        <div className='flex items-center gap-2'>
          <UserAvatar name='Maya Chen' />
          <span className='text-xs font-medium'>Maya Chen</span>
          <span className='text-xs text-muted-foreground'>· now</span>
        </div>
        <p className='mt-2 text-sm leading-snug'>Yes please. The white screen at night is brutal.</p>
      </div>
    </div>
  );
}

function Row({ idea, votes, rank, pulse, lift }: { idea: Idea; votes: number; rank: number; pulse?: number; lift?: number }) {
  return (
    <li
      className={cn('landing-row absolute inset-x-0 top-0 flex items-center gap-4 border-t bg-card px-4 sm:px-5', lift && 'z-10')}
      style={{ height: rowHeight, transform: `translateY(${rank * rowHeight}px)` }}
    >
      {/* Remounted on each overtake so the shadow only shows while the row is moving. */}
      {lift && <span key={`lift-${lift}`} aria-hidden='true' className='landing-lift pointer-events-none absolute inset-0 -z-10' />}
      <span
        key={`vote-${pulse}`}
        className={cn(
          'relative flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-semibold tabular-nums',
          pulse ? 'landing-vote border-primary/30 bg-primary/10 text-primary' : 'bg-card'
        )}
      >
        <ChevronUp className='size-4' strokeWidth={2.5} />
        <span className='h-5 overflow-hidden leading-5'>
          <span key={votes} className={cn('block', pulse && 'landing-roll')}>{votes}</span>
        </span>
        {pulse && <span className='landing-plus pointer-events-none absolute -top-2 left-1/2 text-xs font-semibold text-primary'>+1</span>}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium'>{idea.title}</div>
        <div className='mt-1 flex items-center gap-3 text-xs text-muted-foreground'>
          {idea.status !== 'open' && <StatusBadge status={idea.status} />}
          <TagLabel tag={idea.tag} />
        </div>
      </div>
      <div className='hidden items-center gap-4 text-xs text-muted-foreground sm:flex'>
        <div className='flex -space-x-0.5'>
          {idea.voters.map((name) => <UserAvatar key={name} name={name} className='ring-2 ring-card' />)}
        </div>
        <span className='inline-flex w-8 items-center gap-1'>
          <MessageSquare className='size-3.5' />
          {idea.comments}
        </span>
      </div>
    </li>
  );
}
