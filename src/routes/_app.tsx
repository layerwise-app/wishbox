import { useState } from 'react';
import { createFileRoute, Link, Outlet, redirect, useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, LayoutGrid, Plus, UserRound } from 'lucide-react';
import { CreateProjectDialog } from '~/components/create-project';
import { AccountMenu, Logo, ProjectMark, ThemeToggle } from '~/components/shell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { useSession } from '~/lib/auth-client';
import { getAuthSession } from '~/lib/auth.functions';
import { projectsQuery } from '~/lib/queries';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    return { user: session.user };
  },
  component: AppLayout
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  // The session hook picks up profile edits; the route context covers the first render.
  const { data: session } = useSession();
  const { slug } = useParams({ strict: false });
  const navigate = useNavigate();

  return (
    <>
      <header className='sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md'>
        <div className='mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6'>
          <Link to='/dashboard' aria-label='Projects' className='rounded-md p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
            <Logo className='size-6' />
          </Link>
          {slug && (
            <>
              <span aria-hidden='true' className='text-lg text-border'>/</span>
              <ProjectSwitcher slug={slug} />
            </>
          )}
          <div className='ml-auto flex items-center gap-1.5'>
            <ThemeToggle />
            <AccountMenu user={session?.user ?? user} afterSignOut={() => navigate({ to: '/' })}>
              <DropdownMenuItem asChild>
                <Link to='/dashboard'><LayoutGrid />Projects</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to='/account'><UserRound />Account</Link>
              </DropdownMenuItem>
            </AccountMenu>
          </div>
        </div>
      </header>
      <main className='mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10'>
        <Outlet />
      </main>
    </>
  );
}

function ProjectSwitcher({ slug }: { slug: string }) {
  const projects = useQuery(projectsQuery);
  const [creating, setCreating] = useState(false);
  const current = projects.data?.find((project) => project.slug === slug);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className='flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-muted'>
          {current && <ProjectMark name={current.name} src={current.avatarUrl} className='size-5 rounded-md text-[11px]' />}
          <span className='max-w-40 truncate sm:max-w-60'>{current?.name ?? slug}</span>
          <ChevronsUpDown className='size-3.5 text-muted-foreground' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='w-60'>
          <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>Projects</DropdownMenuLabel>
          {projects.data?.map((project) => (
            <DropdownMenuItem key={project.id} asChild>
              <Link to='/dashboard/$slug' params={{ slug: project.slug }}>
                <ProjectMark name={project.name} src={project.avatarUrl} className='size-5 rounded-md text-[11px]' />
                <span className='truncate'>{project.name}</span>
                {project.slug === slug && <Check className='ml-auto' />}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}><Plus />New project</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
