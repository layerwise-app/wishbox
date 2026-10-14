import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { FileQuestion } from 'lucide-react';
import { EmptyState } from '~/components/feedback-ui';
import { Button } from '~/components/ui/button';

export function NotFound({ title = 'Page not found', children }: { title?: string; children?: ReactNode }) {
  return (
    <main className='mx-auto max-w-6xl px-4 py-24'>
      <EmptyState icon={<FileQuestion />} title={title} description={typeof children === 'string' ? children : undefined}>
        <Button asChild size='sm'>
          <Link to='/'>Go home</Link>
        </Button>
      </EmptyState>
    </main>
  );
}
