import type { CSSProperties, ReactNode } from 'react';
import { Check, ChevronUp, GitMerge } from 'lucide-react';
import { Dot, StatusBadge, UserAvatar, statusDot } from '~/components/feedback-ui';
import { statusLabels } from '~/lib/feedback';
import { cn } from '~/lib/utils';
import { useLoop } from './motion';

export function FeatureTiles() {
  return (
    <div className='grid gap-4 lg:grid-cols-5'>
      <Tile className='lg:col-span-3' index={0} title='No more duplicates' body='Similar ideas show up while people type, so votes land in one place.'>
        <Collect />
      </Tile>
      <Tile className='lg:col-span-2' index={1} title='See what matters' body='Votes and comments rank every idea by real demand.'>
        <Votes />
      </Tile>
      <Tile className='lg:col-span-2' index={0} title='Stay tidy' body='Merge duplicates, hide spam, and sort ideas into categories.'>
        <Merge />
      </Tile>
      <Tile className='lg:col-span-3' index={1} title='A roadmap that keeps itself' body='Change a status and the idea moves across the roadmap.'>
        <Roadmap />
      </Tile>
    </div>
  );
}

function Tile({ title, body, index, className, children }: { title: string; body: string; index: number; className?: string; children: ReactNode }) {
  return (
    <article data-reveal style={{ '--i': index } as CSSProperties} className={cn('flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs', className)}>
      <div className='landing-stage relative flex h-60 items-center justify-center border-b bg-muted/40 px-6 dark:bg-muted/20' aria-hidden='true'>
        {children}
      </div>
      <div className='p-6'>
        <h3 className='font-semibold tracking-tight'>{title}</h3>
        <p className='mt-1.5 text-sm text-muted-foreground'>{body}</p>
      </div>
    </article>
  );
}

const typed = 'Dark theme for the app';
// Clear, type each character, pause, then hold on the suggestion.
const collectFrames = [700, ...Array.from(typed, () => 55), 450, 3400];

function Collect() {
  const [ref, frame] = useLoop<HTMLDivElement>(collectFrames);
  const shown = Math.min(frame, typed.length);
  const suggest = frame === collectFrames.length - 1;
  return (
    <div ref={ref} className='w-full max-w-sm'>
      <div className='flex h-11 items-center rounded-lg border bg-card px-3.5 text-sm shadow-xs ring-3 ring-primary/15'>
        <span className='whitespace-pre'>{typed.slice(0, shown)}</span>
        <span className='landing-caret ml-px h-4 w-px bg-foreground' />
      </div>
      <div className={cn('mt-2 rounded-lg border bg-card p-1.5 shadow-lg transition-all duration-500', suggest ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0')}>
        <div className='px-2 pt-1 pb-1.5 text-xs text-muted-foreground'>Similar idea</div>
        <div className='flex items-center gap-3 rounded-md bg-muted/60 px-2 py-2'>
          <span className='inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-xs font-semibold tabular-nums'>
            <ChevronUp className='size-3.5' strokeWidth={2.5} />
            50
          </span>
          <span className='flex-1 truncate text-sm font-medium'>Dark mode</span>
          <StatusBadge status='in_progress' />
        </div>
      </div>
    </div>
  );
}

const voters = ['Ana Ruiz', 'Tom Hale', 'Ivy Brooks', 'Noah Kim', 'Zoe Hart'];
// Two voters to start, three join, then two comments arrive.
const voteFrames = [900, 520, 520, 700, 900, 2800];

function Votes() {
  const [ref, frame] = useLoop<HTMLDivElement>(voteFrames);
  const joined = Math.min(frame, 3);
  return (
    <div ref={ref} className='w-full max-w-72'>
      <div className='flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm'>
        <span key={joined} className={cn('flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-semibold tabular-nums', joined ? 'landing-vote border-primary/30 bg-primary/10 text-primary' : 'bg-card')}>
          <ChevronUp className='size-4' strokeWidth={2.5} />
          {47 + joined}
        </span>
        <div className='min-w-0 flex-1'>
          <div className='truncate text-sm font-medium'>Slack notifications</div>
          <div className='mt-1.5 flex -space-x-0.5'>
            {voters.slice(0, 2 + joined).map((name, index) => (
              <UserAvatar key={name} name={name} className={cn('ring-2 ring-card', index >= 2 && 'landing-pop')} />
            ))}
          </div>
        </div>
      </div>
      <div className='mt-2 grid min-h-[4.75rem] content-start gap-2'>
        {frame >= 4 && <Bubble name='Ana Ruiz'>Would use this every day.</Bubble>}
        {frame >= 5 && <Bubble name='Tom Hale' className='ml-6'>Same, for our support channel.</Bubble>}
      </div>
    </div>
  );
}

function Bubble({ name, className, children }: { name: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('landing-pop flex items-center gap-2 rounded-xl rounded-tl-sm border bg-card px-2.5 py-1.5 text-xs shadow-xs', className)}>
      <UserAvatar name={name} className='size-5' />
      <span className='truncate'>{children}</span>
    </div>
  );
}

const mergeFrames = [1700, 650, 3000];

function Merge() {
  const [ref, frame] = useLoop<HTMLDivElement>(mergeFrames);
  const merged = frame === 2;
  return (
    <div ref={ref} className='relative w-full max-w-64'>
      <MiniIdea title='Dark mode' votes={merged ? 44 : 32} roll={merged} className='relative z-10'>
        <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground transition-opacity duration-500', merged ? 'opacity-100' : 'opacity-0')}>
          <GitMerge className='size-3.5' />
          1 merged
        </span>
      </MiniIdea>
      <MiniIdea
        title='Night theme'
        votes={12}
        className={cn('mt-2 transition-all duration-600 ease-[cubic-bezier(0.3,0.7,0.2,1)]', frame >= 1 ? '-translate-y-[calc(100%+0.5rem)] scale-95 opacity-0' : 'translate-y-0 opacity-100')}
      >
        <span className='text-xs text-muted-foreground'>Duplicate</span>
      </MiniIdea>
    </div>
  );
}

function MiniIdea({ title, votes, roll, className, children }: { title: string; votes: number; roll?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm', className)}>
      <span className='flex h-11 w-10 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border text-sm font-semibold tabular-nums'>
        <ChevronUp className='size-4' strokeWidth={2.5} />
        <span key={votes} className={cn(roll && 'landing-roll')}>{votes}</span>
      </span>
      <div className='min-w-0'>
        <div className='truncate text-sm font-medium'>{title}</div>
        {children}
      </div>
    </div>
  );
}

const columns = ['planned', 'in_progress', 'completed'] as const;
const roadmapFrames = [1500, 1500, 2600];

function Roadmap() {
  const [ref, frame] = useLoop<HTMLDivElement>(roadmapFrames);
  return (
    <div ref={ref} className='relative grid w-full max-w-md grid-cols-3 gap-2'>
      {columns.map((status) => (
        <div key={status} className='rounded-xl bg-card/70 p-1.5 ring-1 ring-border'>
          <div className='flex h-6 items-center gap-1.5 px-1 text-[11px] font-medium text-muted-foreground'>
            <Dot className={cn('size-1.5', statusDot[status])} />
            <span className='truncate'>{statusLabels[status]}</span>
          </div>
          <div className='mt-1 h-14' />
          <div className='mt-1.5 grid h-14 content-center gap-1.5 rounded-lg border bg-card px-2.5'>
            <span className='h-1.5 w-4/5 rounded-full bg-muted-foreground/20' />
            <span className='h-1.5 w-1/2 rounded-full bg-muted-foreground/15' />
          </div>
        </div>
      ))}
      {/* One column wide, shifted a column (plus the gap) per status. */}
      <div
        className='absolute top-[2.125rem] left-1.5 flex h-14 w-[calc((100%-1rem)/3-0.75rem)] flex-col justify-center gap-1 rounded-lg border bg-card px-2.5 shadow-md transition-transform duration-700 ease-[cubic-bezier(0.3,0.7,0.2,1)]'
        style={{ transform: `translateX(calc(${frame} * (100% + 0.75rem + 0.5rem)))` }}
      >
        <span className='truncate text-xs font-medium'>Dark mode</span>
        <span className='flex items-center gap-1 text-[11px] text-muted-foreground'>
          {frame === 2 ? <Check className='size-3 text-emerald-500' strokeWidth={3} /> : <ChevronUp className='size-3' strokeWidth={2.5} />}
          {frame === 2 ? 'Shipped' : '50'}
        </span>
      </div>
    </div>
  );
}
