import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { Button } from '~/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { Textarea } from '~/components/ui/textarea';
import { ProjectMark } from '~/components/shell';
import { demoSlug, type Project } from '~/lib/feedback';
import { deleteProject, updateProject } from '~/lib/project.functions';

export function ProjectSettings({ project, owner }: { project: Project; owner: boolean }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [avatarUrl, setAvatarUrl] = useState(project.avatarUrl);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => updateProject({ data: { slug: project.slug, name, description, avatarUrl } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Project updated');
    }
  });
  // Partial input like `h` would load as a relative URL, so preview only absolute ones.
  const preview = /^https?:\/\/\S+\.\S+/i.test(avatarUrl.trim()) ? avatarUrl.trim() : undefined;
  const unchanged = name.trim() === project.name && description.trim() === project.description && avatarUrl.trim() === project.avatarUrl;

  return (
    <div className='grid max-w-2xl gap-6'>
      <form
        className='grid gap-4 rounded-xl border bg-card p-5 shadow-xs sm:p-6'
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field className='gap-2'>
          <FieldLabel htmlFor='settings-avatar'>Avatar</FieldLabel>
          <div className='flex items-center gap-3'>
            <ProjectMark name={name || project.name} src={preview} className='size-10 rounded-xl text-base' />
            <Input id='settings-avatar' type='url' placeholder='https://example.com/logo.png' value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} maxLength={500} />
          </div>
          <FieldDescription>A square image URL. Leave empty to use the letter.</FieldDescription>
        </Field>
        <Field className='gap-2'>
          <FieldLabel htmlFor='settings-name'>Name</FieldLabel>
          <Input id='settings-name' value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
        </Field>
        <Field className='gap-2'>
          <FieldLabel htmlFor='settings-description'>Description</FieldLabel>
          <Textarea id='settings-description' placeholder='Shown at the top of the board.' value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={200} />
        </Field>
        <Field className='gap-2'>
          <FieldLabel htmlFor='settings-link'>Link</FieldLabel>
          <Input id='settings-link' value={`/p/${project.slug}`} readOnly disabled className='font-mono' />
          <FieldDescription>Links can’t be changed, so shared URLs keep working.</FieldDescription>
        </Field>
        {save.error && <FieldError>{save.error.message}</FieldError>}
        <div className='flex justify-end'>
          <Button type='submit' disabled={save.isPending || unchanged}>
            {save.isPending && <Spinner />}
            Save
          </Button>
        </div>
      </form>
      {owner && project.id !== demoSlug && <DeleteProject project={project} />}
    </div>
  );
}

function DeleteProject({ project }: { project: Project }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: () => deleteProject({ data: { slug: project.slug } }),
    onSuccess: async () => {
      // Leave first so the deleted project's queries don't refetch.
      await navigate({ to: '/dashboard' });
      client.removeQueries({ queryKey: ['wishbox', 'admin', project.slug] });
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Project deleted');
    },
    onError: (error) => toast.error(error.message)
  });
  return (
    <section className='flex flex-col gap-4 rounded-xl border border-destructive/30 p-5 sm:flex-row sm:items-center sm:p-6'>
      <div className='flex-1'>
        <h2 className='font-semibold'>Delete project</h2>
        <p className='mt-1 text-sm text-muted-foreground'>Removes the board, its ideas, votes, and comments.</p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant='destructive' disabled={remove.isPending}>
            {remove.isPending && <Spinner />}
            Delete project
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size='sm'>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant='destructive' onClick={() => remove.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
