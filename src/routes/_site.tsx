import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Logo, ThemeToggle } from '~/components/shell';
import { Button } from '~/components/ui/button';
import { useSession } from '~/lib/auth-client';

export const Route = createFileRoute('/_site')({
  component: SiteLayout
});

function SiteLayout() {
  const { data: session, isPending } = useSession();
  return (
    <>
      <header className='sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60'>
        <div className='mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6'>
          <Link to='/' className='flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
            <Logo className='size-6' />
            <span className='text-[15px] font-semibold tracking-tight'>Wishbox</span>
          </Link>
          <nav aria-label='Main'>
            <Link to='/p/$slug' params={{ slug: 'demo' }} className='text-sm text-muted-foreground transition-colors hover:text-foreground'>Demo</Link>
          </nav>
          <div className='ml-auto flex items-center gap-1.5'>
            <ThemeToggle />
            {/* Waits for the session so signed-in visitors don't see the sign-in buttons flash. */}
            {isPending ? null : session ? (
              <Button asChild size='sm' className='animate-in fade-in'>
                <Link to='/dashboard'>
                  Dashboard
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <div className='flex animate-in items-center gap-1.5 fade-in'>
                <Button asChild variant='ghost' size='sm' className='hidden sm:inline-flex'>
                  <Link to='/sign-in'>Sign in</Link>
                </Button>
                <Button asChild size='sm'>
                  <Link to='/sign-up'>Get started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
