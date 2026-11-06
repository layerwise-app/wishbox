import { useRef, useState } from 'react';
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
import { avatarAccept, avatarTooLarge, maxAvatarBytes } from '~/lib/avatar';
import { demoSlug, type Project } from '~/lib/feedback';
import { deleteProject, removeProjectAvatar, updateProject, uploadProjectAvatar } from '~/lib/project.functions';

export function ProjectSettings({ project, owner }: { project: Project; owner: boolean }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => updateProject({ data: { slug: project.slug, name, description } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Project updated');
    }
  });
  const unchanged = name.trim() === project.name && description.trim() === project.description;

  return (
    <div className='grid max-w-2xl gap-6'>
      <form
        className='grid gap-4 rounded-xl border bg-card p-5 shadow-xs sm:p-6'
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <AvatarField project={project} name={name || project.name} />
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

/** Uploads and removes save right away, separately from the form's Save. */
function AvatarField({ project, name }: { project: Project; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const upload = useMutation({
    mutationFn: (file: File) => {
      if (file.size > maxAvatarBytes) throw new Error(avatarTooLarge);
      const form = new FormData();
      form.set('slug', project.slug);
      form.set('file', file);
      return uploadProjectAvatar({ data: form });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Avatar updated');
    }
  });
  const remove = useMutation({
    mutationFn: () => removeProjectAvatar({ data: { slug: project.slug } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Avatar removed');
    }
  });
  const pending = upload.isPending || remove.isPending;
  const error = upload.error ?? remove.error;

  return (
    <Field className='gap-2'>
      <FieldLabel htmlFor='settings-avatar'>Avatar</FieldLabel>
      <div className='flex items-center gap-3'>
        <ProjectMark name={name} src={project.avatarUrl || undefined} className='size-10 rounded-xl text-base' />
        <input
          ref={input}
          id='settings-avatar'
          type='file'
          accept={avatarAccept}
          className='sr-only'
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clear it so choosing the same file again still uploads.
            event.target.value = '';
            if (!file) return;
            remove.reset();
            upload.mutate(file);
          }}
        />
        <Button type='button' variant='outline' size='sm' disabled={pending} onClick={() => input.current?.click()}>
          {upload.isPending && <Spinner />}
          Upload
        </Button>
        {project.avatarUrl && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={pending}
            onClick={() => {
              upload.reset();
              remove.mutate();
            }}
          >
            {remove.isPending && <Spinner />}
            Remove
          </Button>
        )}
      </div>
      <FieldDescription>A square PNG, JPEG, WebP, or GIF, up to 2 MB.</FieldDescription>
      {error && <FieldError>{error.message}</FieldError>}
    </Field>
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
