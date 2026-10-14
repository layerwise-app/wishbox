import { useState, type ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { authClient, useSession } from '~/lib/auth-client';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_app/account')({
  head: () => ({ meta: seo({ title: 'Account | Wishbox' }) }),
  component: Account
});

function Account() {
  return (
    <div className='mx-auto max-w-xl'>
      <h1 className='text-2xl font-semibold tracking-tight'>Account</h1>
      <div className='mt-6 grid gap-6'>
        <Profile />
        <Password />
      </div>
    </div>
  );
}

function Section({ title, onSubmit, children }: { title: string; onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      className='grid gap-4 rounded-xl border bg-card p-5 shadow-xs sm:p-6'
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className='font-semibold'>{title}</h2>
      {children}
    </form>
  );
}

function Profile() {
  const viewer = useSession().data?.user;
  // `null` until edited, so the field follows the session while it loads.
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? viewer?.name ?? '';
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.updateUser({ name: name.trim() });
      if (error) throw new Error(error.message || 'Could not update your name.');
    },
    onSuccess: async () => {
      setDraft(null);
      toast.success('Name updated');
      // Author names appear across the board.
      await client.invalidateQueries({ queryKey: ['wishbox'] });
    }
  });
  return (
    <Section title='Profile' onSubmit={() => save.mutate()}>
      <Field className='gap-2'>
        <FieldLabel htmlFor='account-name'>Name</FieldLabel>
        <Input id='account-name' autoComplete='name' value={name} onChange={(e) => setDraft(e.target.value)} required minLength={2} maxLength={100} />
      </Field>
      <Field className='gap-2'>
        <FieldLabel htmlFor='account-email'>Email</FieldLabel>
        <Input id='account-email' value={viewer?.email ?? ''} readOnly disabled />
      </Field>
      {save.error && <FieldError>{save.error.message}</FieldError>}
      <div className='flex justify-end'>
        <Button type='submit' disabled={save.isPending || draft === null || name.trim() === viewer?.name}>
          {save.isPending && <Spinner />}
          Save
        </Button>
      </div>
    </Section>
  );
}

function Password() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
      if (error) throw new Error(error.message || 'Could not change your password.');
    },
    onSuccess: () => {
      setCurrent('');
      setNext('');
      toast.success('Password changed. Other devices were signed out.');
    }
  });
  return (
    <Section title='Password' onSubmit={() => save.mutate()}>
      <Field className='gap-2'>
        <FieldLabel htmlFor='current-password'>Current password</FieldLabel>
        <Input id='current-password' type='password' autoComplete='current-password' value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field className='gap-2'>
        <FieldLabel htmlFor='next-password'>New password</FieldLabel>
        <Input id='next-password' type='password' autoComplete='new-password' placeholder='At least 8 characters' minLength={8} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      {save.error && <FieldError>{save.error.message}</FieldError>}
      <div className='flex justify-end'>
        <Button type='submit' disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Change password
        </Button>
      </div>
    </Section>
  );
}
