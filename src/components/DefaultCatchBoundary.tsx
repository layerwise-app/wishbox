import { Link, rootRouteId, useMatch, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { EmptyState } from '~/components/feedback-ui';
import { Button } from '~/components/ui/button';

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({ strict: false, select: (state) => state.id === rootRouteId });
  console.error(error);
  return (
    <EmptyState icon={<TriangleAlert />} title='Something went wrong' description={error instanceof Error ? error.message : undefined}>
      <div className='flex gap-2'>
        <Button size='sm' onClick={() => void router.invalidate()}>Try again</Button>
        {isRoot ? (
          <Button asChild variant='outline' size='sm'><Link to='/'>Home</Link></Button>
        ) : (
          <Button variant='outline' size='sm' onClick={() => window.history.back()}>Go back</Button>
        )}
      </div>
    </EmptyState>
  );
}
