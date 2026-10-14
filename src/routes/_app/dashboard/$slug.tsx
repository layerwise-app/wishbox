import { useState } from 'react';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Check, Copy, FileQuestion } from 'lucide-react';
import { AdminCategories } from '~/components/admin-categories';
import { AdminIdeas } from '~/components/admin-ideas';
import { EmptyState } from '~/components/feedback-ui';
import { ProjectSettings } from '~/components/project-settings';
import { ProjectTeam } from '~/components/project-team';
import { ProjectMark } from '~/components/shell';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import type { Post } from '~/lib/feedback';
import { adminQuery, projectsQuery } from '~/lib/queries';
import { seo } from '~/utils/seo';

const tabs = { ideas: 'Ideas', categories: 'Categories', team: 'Team', settings: 'Settings' } as const;
type Tab = Exclude<keyof typeof tabs, 'ideas'>;

export const Route = createFileRoute('/_app/dashboard/$slug')({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => ({
    tab: search.tab === 'categories' || search.tab === 'team' || search.tab === 'settings' ? search.tab : undefined
  }),
  loader: async ({ context, params }) => {
    // Checking membership first turns other people's projects into a plain "not found".
    const projects = await context.queryClient.ensureQueryData(projectsQuery);
    if (!projects.some((project) => project.slug === params.slug)) throw notFound();
    const board = await context.queryClient.ensureQueryData(adminQuery(params.slug));
    return { name: board.project.name };
  },
  head: ({ loaderData }) => ({ meta: seo({ title: `${loaderData?.name ?? 'Project'} | Wishbox` }) }),
  notFoundComponent: () => (
    <EmptyState icon={<FileQuestion />} title='Project not found' description='It doesn’t exist, or you’re not on its team.'>
      <Button asChild size='sm'><Link to='/dashboard'>All projects</Link></Button>
    </EmptyState>
  ),
  component: ProjectDashboard
});

function ProjectDashboard() {
  const { slug } = Route.useParams();
  const { tab = 'ideas' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const board = useQuery(adminQuery(slug));
  if (!board.data) return null;
  const { project, role, posts } = board.data;

  return (
    <div className='grid gap-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
        <div className='flex min-w-0 items-center gap-3.5'>
          <ProjectMark name={project.name} src={project.avatarUrl} className='size-11 rounded-xl text-lg' />
          <div className='min-w-0'>
            <h1 className='truncate text-2xl font-semibold tracking-tight'>{project.name}</h1>
            <p className='truncate font-mono text-xs text-muted-foreground'>/p/{project.slug}</p>
          </div>
        </div>
        <div className='flex gap-2 sm:ml-auto'>
          <CopyLink path={`/p/${project.slug}`} />
          <Button asChild size='sm'>
            <Link to='/p/$slug' params={{ slug }}>
              View board
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </div>

      <Stats posts={posts} />

      <Tabs
        value={tab}
        onValueChange={(value) => void navigate({ search: { tab: value === 'ideas' ? undefined : (value as Tab) }, replace: true })}
        className='gap-5'
      >
        <TabsList>
          {Object.entries(tabs).map(([value, label]) => <TabsTrigger key={value} value={value} className='px-3'>{label}</TabsTrigger>)}
        </TabsList>
        <TabsContent value='ideas'><AdminIdeas slug={slug} /></TabsContent>
        <TabsContent value='categories'><AdminCategories slug={slug} /></TabsContent>
        <TabsContent value='team'><ProjectTeam slug={slug} owner={role === 'owner'} /></TabsContent>
        <TabsContent value='settings'><ProjectSettings key={project.id} project={project} owner={role === 'owner'} /></TabsContent>
      </Tabs>
    </div>
  );
}

function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant='outline'
      size='sm'
      onClick={async () => {
        await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}

function Stats({ posts }: { posts: Post[] }) {
  const active = posts.filter((post) => !post.mergedIntoId);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const stats = [
    { label: 'Ideas', value: active.length },
    { label: 'Votes', value: active.reduce((sum, post) => sum + post.voteCount, 0) },
    { label: 'Comments', value: active.reduce((sum, post) => sum + post.commentCount, 0) },
    { label: 'New this week', value: active.filter((post) => post.createdAt > weekAgo).length }
  ];
  return (
    <dl className='grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-xs sm:grid-cols-4'>
      {stats.map((stat, index) => (
        <div key={stat.label} className={`px-5 py-4 ${index % 2 ? 'border-l' : ''} ${index > 1 ? 'border-t sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l' : ''}`}>
          <dt className='text-xs text-muted-foreground'>{stat.label}</dt>
          <dd className='mt-1 text-2xl font-semibold tracking-tight tabular-nums'>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
