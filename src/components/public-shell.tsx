import { useRef, useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { ArrowRight, Lightbulb, Plus, Settings2 } from 'lucide-react';
import { AuthForm } from '~/components/auth-form';
import { BoardContext, type Viewer } from '~/components/board-context';
import { NewIdeaDialog } from '~/components/idea-dialog';
import { AccountMenu, Logo, ProjectMark, ThemeToggle } from '~/components/shell';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { DropdownMenuItem } from '~/components/ui/dropdown-menu';
import { useSession } from '~/lib/auth-client';
import type { Project, ProjectRole } from '~/lib/feedback';
import { cn } from '~/lib/utils';

/** The public site of one project: its feedback board, roadmap, and idea pages. */
export function PublicShell({ project, role, demo, children }: { project: Project; role: ProjectRole | null; demo: boolean; children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [authOpen, setAuthOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // The action that prompted sign-in, resumed once the visitor has an account.
  const afterAuth = useRef<(() => void) | null>(null);
  const viewer: Viewer | null = session?.user ?? null;
  const params = { slug: project.slug };

  const requireUser = (callback: () => void) => {
    if (viewer) return callback();
    afterAuth.current = callback;
    setAuthOpen(true);
  };
  const openAuth = () => {
    afterAuth.current = null;
    setAuthOpen(true);
  };
  const openCreate = () => requireUser(() => setCreateOpen(true));

  return (
    <BoardContext value={{ project, role, viewer, requireUser, openAuth, openCreate }}>
      {demo && (
        <div className='bg-foreground text-background'>
          <div className='mx-auto flex h-9 max-w-6xl items-center justify-center gap-2 px-4 text-[13px] sm:px-6'>
            <span className='text-background/70'>Demo board</span>
            <span aria-hidden='true' className='text-background/40'>·</span>
            <Link to={viewer ? '/dashboard' : '/sign-up'} className='inline-flex items-center gap-1 font-medium hover:underline'>
              Create your own
              <ArrowRight className='size-3.5' />
            </Link>
          </div>
        </div>
      )}
      <header className='sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md'>
        <div className='mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6'>
          <Link to='/p/$slug' params={params} className='flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
            <ProjectMark name={project.name} src={project.avatarUrl} />
            <span className='hidden truncate text-[15px] font-semibold tracking-tight sm:inline'>{project.name}</span>
          </Link>
          <nav className='flex items-center gap-0.5' aria-label='Main'>
            <NavLink to='/p/$slug' params={params} active={!pathname.endsWith('/roadmap')}>Feedback</NavLink>
            <NavLink to='/p/$slug/roadmap' params={params} active={pathname.endsWith('/roadmap')}>Roadmap</NavLink>
          </nav>
          <div className='ml-auto flex items-center gap-1.5'>
            <ThemeToggle />
            {role && (
              <Button asChild variant='ghost' size='sm' className='hidden sm:inline-flex'>
                <Link to='/dashboard/$slug' params={params}>Manage</Link>
              </Button>
            )}
            {viewer ? (
              <AccountMenu user={viewer}>
                <DropdownMenuItem asChild>
                  <Link to='/p/$slug' params={params} search={{ status: 'mine' }}><Lightbulb />My ideas</Link>
                </DropdownMenuItem>
                {role && (
                  <DropdownMenuItem asChild>
                    <Link to='/dashboard/$slug' params={params}><Settings2 />Manage board</Link>
                  </DropdownMenuItem>
                )}
              </AccountMenu>
            ) : (
              <Button variant='ghost' size='sm' onClick={openAuth}>Sign in</Button>
            )}
            <Button size='sm' onClick={openCreate} aria-label='New idea'>
              <Plus />
              <span className='hidden sm:inline'>New idea</span>
            </Button>
          </div>
        </div>
      </header>
      <main className='mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10'>{children}</main>
      <footer className='pb-10'>
        <Link to='/' className='mx-auto flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground'>
          Powered by
          <Logo className='size-3.5' />
          <span className='font-medium'>Wishbox</span>
        </Link>
      </footer>
      <Dialog
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) afterAuth.current = null;
        }}
      >
        <DialogContent className='sm:max-w-sm'>
          <AuthForm
            description={`Vote and share ideas on ${project.name}.`}
            onSuccess={() => {
              const resume = afterAuth.current;
              afterAuth.current = null;
              setAuthOpen(false);
              resume?.();
            }}
          />
        </DialogContent>
      </Dialog>
      <NewIdeaDialog open={createOpen} onOpenChange={setCreateOpen} />
    </BoardContext>
  );
}

function NavLink({ to, params, active, children }: { to: '/p/$slug' | '/p/$slug/roadmap'; params: { slug: string }; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      params={params}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
        active && 'bg-muted text-foreground'
      )}
    >
      {children}
    </Link>
  );
}
