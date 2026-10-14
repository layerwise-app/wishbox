import type { CSSProperties, ReactNode } from 'react';
import { Check, ChevronUp, Copy, Lock } from 'lucide-react';
import { UserAvatar } from '~/components/feedback-ui';
import { ProjectMark } from '~/components/shell';
import { cn } from '~/lib/utils';
import { useLoop } from './motion';

export function HowItWorks() {
  return (
    <ol className='grid gap-4 md:grid-cols-3'>
      <Step index={0} title='Create a project' body='Name it and pick a link.'>
        <Create />
      </Step>
      <Step index={1} title='Share the link' body='Your users sign in on the board itself.'>
        <Share />
      </Step>
      <Step index={2} title='Collect feedback' body='Ideas and votes arrive in your dashboard.'>
        <Collect />
      </Step>
    </ol>
  );
}

function Step({ index, title, body, children }: { index: number; title: string; body: string; children: ReactNode }) {
  return (
    <li data-reveal style={{ '--i': index } as CSSProperties} className='flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs'>
      <div className='landing-stage relative flex h-52 items-center justify-center border-b bg-muted/40 px-6 dark:bg-muted/20' aria-hidden='true'>
        {children}
      </div>
      <div className='flex gap-3 p-6'>
        <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background tabular-nums'>{index + 1}</span>
        <div>
          <h3 className='font-semibold tracking-tight'>{title}</h3>
          <p className='mt-1 text-sm text-muted-foreground'>{body}</p>
        </div>
      </div>
    </li>
  );
}

const name = 'Acme';
// Clear, type the name, press create, then hold on the new project.
const createFrames = [800, ...Array.from(name, () => 140), 700, 3000];

function Create() {
  const [ref, frame] = useLoop<HTMLDivElement>(createFrames);
  const typed = name.slice(0, Math.min(frame, name.length));
  const created = frame === createFrames.length - 1;
  return (
    <div ref={ref} className='relative w-full max-w-60'>
      <div className={cn('grid gap-2.5 rounded-xl border bg-card p-3.5 shadow-sm transition-all duration-500', created && 'scale-95 opacity-0')}>
        <div className='flex h-8 items-center rounded-md border px-2.5 text-sm ring-3 ring-primary/15'>
          <span className='whitespace-pre'>{typed}</span>
          <span className='landing-caret ml-px h-4 w-px bg-foreground' />
        </div>
        <div className='flex h-8 items-center rounded-md border bg-muted/50 px-2.5 font-mono text-xs text-muted-foreground'>
          /p/<span className='text-foreground'>{typed.toLowerCase()}</span>
        </div>
        <div className={cn('flex h-8 items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground transition-transform', frame === name.length + 1 && 'scale-95')}>
          Create project
        </div>
      </div>
      {created && (
        <div className='landing-pop absolute inset-x-0 top-1/2 -translate-y-1/2'>
          <div className='flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg'>
            <ProjectMark name={name} className='size-9 rounded-lg' />
            <div className='min-w-0 flex-1'>
              <div className='text-sm font-semibold'>{name}</div>
              <div className='font-mono text-xs text-muted-foreground'>/p/acme</div>
            </div>
            <Check className='size-4 text-emerald-500' strokeWidth={3} />
          </div>
        </div>
      )}
    </div>
  );
}

const visitors = ['Maya Chen', 'Leo Park', 'Ana Ruiz', 'Sam Ortiz'];
// Idle, copied, then people arrive one by one.
const shareFrames = [1200, 700, 380, 380, 380, 2600];

function Share() {
  const [ref, frame] = useLoop<HTMLDivElement>(shareFrames);
  const copied = frame >= 1;
  const arrived = Math.max(0, frame - 1);
  return (
    <div ref={ref} className='w-full max-w-64'>
      <div className='flex h-10 items-center gap-2 rounded-full border bg-card pr-1 pl-3.5 shadow-sm'>
        <Lock className='size-3 shrink-0 text-muted-foreground' />
        <span className='flex-1 truncate text-xs'>
          <span className='text-muted-foreground'>yourapp.com</span>/p/acme
        </span>
        <span
          key={String(copied)}
          className={cn(
            'inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium',
            copied ? 'landing-pop bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-primary text-primary-foreground'
          )}
        >
          {copied ? <Check className='size-3.5' strokeWidth={3} /> : <Copy className='size-3.5' />}
          {copied ? 'Copied' : 'Copy'}
        </span>
      </div>
      <div className='mt-5 flex h-9 items-center justify-center -space-x-2'>
        {visitors.slice(0, arrived).map((visitor) => (
          <UserAvatar key={visitor} name={visitor} size='lg' className='landing-pop ring-3 ring-background' />
        ))}
      </div>
    </div>
  );
}

const ideas = [
  { title: 'Dark mode', votes: 48 },
  { title: 'Slack notifications', votes: 31 }
];
// Votes tick up on the top idea, then the second.
const collectFrames = [900, 450, 450, 450, 600, 2400];

function Collect() {
  const [ref, frame] = useLoop<HTMLDivElement>(collectFrames);
  const added = [Math.min(frame, 3), Math.max(0, frame - 3)];
  return (
    <div ref={ref} className='grid w-full max-w-64 gap-2'>
      {ideas.map((idea, index) => {
        const votes = idea.votes + added[index];
        const active = added[index] > 0;
        return (
          <div key={idea.title} className='flex items-center gap-3 rounded-xl border bg-card p-2.5 shadow-sm'>
            <span
              key={votes}
              className={cn(
                'flex h-11 w-10 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border text-sm font-semibold tabular-nums',
                active ? 'landing-vote border-primary/30 bg-primary/10 text-primary' : 'bg-card'
              )}
            >
              <ChevronUp className='size-4' strokeWidth={2.5} />
              <span className={cn(active && 'landing-roll')}>{votes}</span>
            </span>
            <span className='truncate text-sm font-medium'>{idea.title}</span>
          </div>
        );
      })}
    </div>
  );
}
