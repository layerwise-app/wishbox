import type { CSSProperties } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronUp } from 'lucide-react';
import { FeatureTiles } from '~/components/landing/feature-tiles';
import { HeroBoard } from '~/components/landing/hero-board';
import { HowItWorks } from '~/components/landing/how-it-works';
import { useReveal } from '~/components/landing/motion';
import { Logo } from '~/components/shell';
import { Button } from '~/components/ui/button';
import { demoSlug } from '~/lib/feedback';
import { boardQuery } from '~/lib/queries';
import { seo } from '~/utils/seo';

const demo = boardQuery(demoSlug);
const demoLink = { to: '/p/$slug', params: { slug: demoSlug } } as const;

export const Route = createFileRoute('/_site/')({
  // Prefetch rather than ensure: the page still renders if the demo board is unavailable.
  loader: ({ context }) => context.queryClient.prefetchQuery(demo),
  head: () => ({ meta: seo({ title: 'Wishbox', description: 'Feedback boards and public roadmaps for your product.' }) }),
  component: Landing
});

const cta = 'h-11 rounded-lg px-5 text-[15px]';
const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

function Landing() {
  useReveal();
  const board = useQuery(demo);
  const posts = board.data?.posts ?? [];

  return (
    <>
      <section className='relative isolate overflow-hidden'>
        <div aria-hidden='true' className='landing-grid absolute inset-0 -z-10' />
        <div aria-hidden='true' className='landing-glow absolute inset-x-0 -top-48 -z-10 h-[40rem]' />
        <div className='mx-auto max-w-6xl px-4 pt-12 pb-12 sm:px-6 sm:pt-20 sm:pb-16 xl:pb-24'>
          <div className='mx-auto max-w-3xl text-center'>
            <Link
              {...demoLink}
              className='animate-rise inline-flex h-8 items-center gap-2 rounded-full border bg-card/70 pr-2.5 pl-3 text-sm text-muted-foreground shadow-xs backdrop-blur transition-colors hover:text-foreground'
              style={stagger(0)}
            >
              <span className='relative flex size-2'>
                <span className='landing-ping absolute inset-0 rounded-full bg-emerald-500' />
                <span className='relative size-2 rounded-full bg-emerald-500' />
              </span>
              <span className='font-medium text-foreground'>Live demo</span>
              {board.data && (
                <span className='hidden sm:inline'>
                  · <b className='font-medium text-foreground tabular-nums'>{posts.length}</b> ideas ·{' '}
                  <b className='font-medium text-foreground tabular-nums'>{posts.reduce((sum, post) => sum + post.voteCount, 0)}</b> votes
                </span>
              )}
              <ArrowRight className='size-3.5' />
            </Link>
            <h1 className='animate-rise mt-6 text-[2.75rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl' style={stagger(1)}>
              Build what users <span className='landing-headline'>ask for</span>
            </h1>
            <p className='animate-rise mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground' style={stagger(2)}>
              A feedback board and public roadmap for every product you run. Your users vote, you ship.
            </p>
            <div className='animate-rise mt-8 flex flex-col justify-center gap-3 sm:flex-row' style={stagger(3)}>
              <Button asChild className={cta}>
                <Link to='/sign-up'>
                  Get started
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant='outline' className={`${cta} bg-card/70 backdrop-blur`}>
                <Link {...demoLink}>View demo</Link>
              </Button>
            </div>
          </div>
          <div className='animate-rise mx-auto mt-14 max-w-3xl sm:mt-20' style={stagger(5)}>
            <div className='landing-tilt'>
              <HeroBoard />
            </div>
          </div>
        </div>
      </section>

      <section className='mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20'>
        <h2 data-reveal className='mx-auto max-w-xl text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
          Live in a minute
        </h2>
        <div className='mt-10 sm:mt-14'>
          <HowItWorks />
        </div>
      </section>

      <section className='mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20'>
        <h2 data-reveal className='mx-auto max-w-xl text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
          From first idea to shipped
        </h2>
        <div className='mt-10 sm:mt-14'>
          <FeatureTiles />
        </div>
      </section>

      <section className='mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-6 sm:pb-24'>
        <div data-reveal className='relative isolate overflow-hidden rounded-3xl bg-linear-to-br from-primary to-violet-600 px-6 py-16 text-center text-primary-foreground sm:py-24 dark:from-primary/75 dark:to-violet-600/70'>
          <Chips />
          <h2 className='text-3xl font-semibold tracking-tight text-balance sm:text-5xl'>Start listening</h2>
          <p className='mx-auto mt-3 max-w-md text-pretty text-primary-foreground/80'>Your first board is a minute away.</p>
          <div className='mt-8 flex flex-col justify-center gap-3 sm:flex-row'>
            <Button asChild className={`${cta} bg-white text-primary shadow-lg shadow-black/10 hover:bg-white/90 dark:bg-white dark:text-primary`}>
              <Link to='/sign-up'>
                Get started
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant='ghost' className={`${cta} text-primary-foreground hover:bg-white/10 hover:text-primary-foreground dark:hover:bg-white/10`}>
              <Link {...demoLink}>View demo</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className='border-t'>
        <div className='mx-auto flex max-w-6xl items-center gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6'>
          <Logo className='size-5' />
          <span className='font-medium text-foreground'>Wishbox</span>
          <nav className='ml-auto flex gap-5' aria-label='Footer'>
            <Link {...demoLink} className='hover:text-foreground'>Demo</Link>
            <Link to='/dashboard' className='hover:text-foreground'>Dashboard</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

// Vote counts drifting up behind the closing call to action.
const chips = [
  { left: '6%', bottom: '8%', votes: 128, d: '15s', delay: '-2s' },
  { left: '18%', bottom: '-6%', votes: 54, d: '12s', delay: '-8s' },
  { left: '30%', bottom: '2%', votes: 17, d: '17s', delay: '-12s', wide: true },
  { left: '68%', bottom: '-4%', votes: 86, d: '14s', delay: '-5s', wide: true },
  { left: '80%', bottom: '6%', votes: 241, d: '16s', delay: '-10s' },
  { left: '91%', bottom: '-8%', votes: 33, d: '13s', delay: '-1s' }
];

function Chips() {
  return (
    <div aria-hidden='true' className='absolute inset-0 -z-10'>
      <div className='absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_0%,rgb(255_255_255/0.18),transparent)]' />
      {chips.map((chip) => (
        <span
          key={chip.votes}
          className={`landing-drift absolute -translate-x-1/2 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/75 ring-1 ring-white/20 backdrop-blur-sm tabular-nums hidden ${chip.wide ? 'lg:inline-flex' : 'sm:inline-flex'}`}
          style={{ left: chip.left, bottom: chip.bottom, '--d': chip.d, '--delay': chip.delay } as CSSProperties}
        >
          <ChevronUp className='size-3.5' strokeWidth={2.5} />
          {chip.votes}
        </span>
      ))}
    </div>
  );
}
