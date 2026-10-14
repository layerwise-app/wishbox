import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState, PostListSkeleton, UserAvatar } from '~/components/feedback-ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '~/components/ui/alert-dialog';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { FieldError } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { addMember, removeMember } from '~/lib/project.functions';
import { membersQuery } from '~/lib/queries';

/** Team members can moderate the board. Only the owner adds or removes them. */
export function ProjectTeam({ slug, owner }: { slug: string; owner: boolean }) {
  const members = useQuery(membersQuery(slug));
  const [email, setEmail] = useState('');
  const client = useQueryClient();
  const add = useMutation({
    mutationFn: () => addMember({ data: { slug, email } }),
    onSuccess: async () => {
      setEmail('');
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Added to the team');
    }
  });

  return (
    <div className='grid max-w-2xl gap-4'>
      {owner && (
        <form
          className='grid gap-2'
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <div className='flex gap-2'>
            <Input type='email' aria-label='Email' placeholder='teammate@example.com' className='bg-card' value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type='submit' disabled={add.isPending}>
              {add.isPending && <Spinner />}
              Add
            </Button>
          </div>
          {add.error && <FieldError>{add.error.message}</FieldError>}
        </form>
      )}
      <div className='overflow-hidden rounded-xl border bg-card shadow-xs'>
        {members.isLoading ? (
          <PostListSkeleton rows={2} />
        ) : members.error ? (
          <ErrorState message={members.error.message} retry={() => void members.refetch()} />
        ) : (
          <ul className='divide-y'>
            {members.data?.map((member) => (
              <li key={member.id} className='flex h-16 items-center gap-3 pr-2 pl-4'>
                <UserAvatar name={member.name} size='default' />
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>{member.name}</div>
                  <div className='truncate text-xs text-muted-foreground'>{member.email}</div>
                </div>
                <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className='capitalize'>{member.role}</Badge>
                {owner && member.role !== 'owner' ? <RemoveMember slug={slug} member={member} /> : <span className='w-8' />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RemoveMember({ slug, member }: { slug: string; member: { id: string; name: string } }) {
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeMember({ data: { slug, userId: member.id } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Removed from the team');
    },
    onError: (error) => toast.error(error.message)
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant='ghost' size='icon-sm' aria-label={`Remove ${member.name}`} className='text-muted-foreground hover:text-destructive'><Trash2 /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
          <AlertDialogDescription>They keep their account but can no longer manage this board.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant='destructive' onClick={() => remove.mutate()}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
