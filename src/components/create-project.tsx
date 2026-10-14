import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '~/components/ui/input-group';
import { Spinner } from '~/components/ui/spinner';
import { Textarea } from '~/components/ui/textarea';
import { slugify } from '~/lib/feedback';
import { createProject } from '~/lib/project.functions';

export function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState('');
  // `null` until edited, so the link follows the name.
  const [slugDraft, setSlugDraft] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const slug = slugDraft ?? slugify(name);
  const client = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: () => createProject({ data: { name, slug, description } }),
    onSuccess: async (project) => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      onOpenChange(false);
      setName('');
      setSlugDraft(null);
      setDescription('');
      await navigate({ to: '/dashboard/$slug', params: { slug: project.slug } });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold'>New project</DialogTitle>
          <DialogDescription>Each project gets its own feedback board and roadmap.</DialogDescription>
        </DialogHeader>
        <form
          id='new-project'
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field className='gap-2'>
            <FieldLabel htmlFor='project-name'>Name</FieldLabel>
            <Input id='project-name' autoFocus placeholder='Acme' value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
          </Field>
          <Field className='gap-2'>
            <FieldLabel htmlFor='project-slug'>Link</FieldLabel>
            <InputGroup>
              <InputGroupAddon><InputGroupText>/p/</InputGroupText></InputGroupAddon>
              <InputGroupInput
                id='project-slug'
                placeholder='acme'
                value={slug}
                onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
                required
                minLength={3}
                maxLength={40}
                pattern='[a-z0-9]+(-[a-z0-9]+)*'
                title='Lowercase letters, numbers, and single dashes'
                className='pl-0.5'
              />
            </InputGroup>
            <FieldDescription>Can’t be changed later.</FieldDescription>
          </Field>
          <Field className='gap-2'>
            <FieldLabel htmlFor='project-description'>Description</FieldLabel>
            <Textarea id='project-description' placeholder='Optional. Shown at the top of the board.' value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={200} />
          </Field>
          {create.error && <FieldError>{create.error.message}</FieldError>}
        </form>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type='submit' form='new-project' disabled={create.isPending}>
            {create.isPending && <Spinner />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
