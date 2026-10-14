import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, LayoutGrid, Plus } from 'lucide-react';
import { CreateProjectDialog } from '~/components/create-project';
import { EmptyState, ErrorState } from '~/components/feedback-ui';
import { ProjectMark } from '~/components/shell';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { demoSlug } from '~/lib/feedback';
import { projectsQuery } from '~/lib/queries';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_app/dashboard/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery),
  head: () => ({ meta: seo({ title: 'Projects | Wishbox' }) }),
  component: Dashboard
});

function Dashboard() {
  const projects = useQuery(projectsQuery);
  const [creating, setCreating] = useState(false);
  const list = projects.data ?? [];

  return (
    <div className='grid gap-6'>
      <div className='flex items-center justify-between gap-4'>
        <h1 className='text-2xl font-semibold tracking-tight'>Projects</h1>
        {list.length > 0 && <Button size='sm' onClick={() => setCreating(true)}><Plus />New project</Button>}
      </div>
      {projects.error ? (
        <ErrorState message={projects.error.message} retry={() => void projects.refetch()} />
      ) : list.length ? (
        <ul className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {list.map((project) => (
            <li key={project.id} className='group relative flex flex-col rounded-xl border bg-card p-5 shadow-xs transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md'>
              <div className='flex items-start gap-3'>
                <ProjectMark name={project.name} src={project.avatarUrl} className='size-10 rounded-xl text-base' />
                <div className='min-w-0 flex-1'>
                  <Link
                    to='/dashboard/$slug'
                    params={{ slug: project.slug }}
                    className='block truncate font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50'
                  >
                    {project.name}
                  </Link>
                  <p className='truncate font-mono text-xs text-muted-foreground'>/p/{project.slug}</p>
                </div>
                {project.role !== 'owner' && <Badge variant='secondary' className='capitalize'>{project.role}</Badge>}
              </div>
              <p className='mt-4 line-clamp-2 min-h-10 text-sm text-muted-foreground'>{project.description || 'No description'}</p>
              <div className='mt-4 flex items-center gap-3 border-t pt-3.5 text-xs text-muted-foreground'>
                <span><b className='font-medium text-foreground tabular-nums'>{project.ideas}</b> ideas</span>
                <span><b className='font-medium text-foreground tabular-nums'>{project.votes}</b> votes</span>
                <Link
                  to='/p/$slug'
                  params={{ slug: project.slug }}
                  className='relative z-10 ml-auto inline-flex items-center gap-0.5 rounded-sm font-medium hover:text-foreground'
                >
                  Board
                  <ArrowUpRight className='size-3.5' />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className='rounded-xl border border-dashed'>
          <EmptyState icon={<LayoutGrid />} title='Create your first project' description='Each project gets a public feedback board and roadmap.'>
            <div className='flex gap-2'>
              <Button size='sm' onClick={() => setCreating(true)}><Plus />New project</Button>
              <Button asChild variant='outline' size='sm'>
                <Link to='/p/$slug' params={{ slug: demoSlug }}>View demo</Link>
              </Button>
            </div>
          </EmptyState>
        </div>
      )}
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
