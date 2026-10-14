import { useDeferredValue, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { useBoard } from '~/components/board-context';
import { Dot, tagDot } from '~/components/feedback-ui';
import { RichTextEditor } from '~/components/rich-text-editor';
import { findSimilar } from '~/lib/feedback';
import { createPost } from '~/lib/feedback.functions';
import { boardQuery } from '~/lib/queries';

export function NewIdeaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagId, setTagId] = useState('');
  const { slug } = useBoard().project;
  const board = useQuery({ ...boardQuery(slug), enabled: open });
  const client = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: () => createPost({ data: { slug, title, description, tagId } }),
    onSuccess: async ({ id }) => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setTagId('');
      toast.success('Idea posted');
      await navigate({ to: '/p/$slug/ideas/$postId', params: { slug, postId: id } });
    }
  });
  const similar = findSimilar(board.data?.posts ?? [], useDeferredValue(title));
  const tags = board.data?.tags ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold'>New idea</DialogTitle>
          <DialogDescription>Everyone can see, vote on, and comment on ideas.</DialogDescription>
        </DialogHeader>
        <form
          id='new-idea'
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field className='gap-2'>
            <FieldLabel htmlFor='idea-title'>Title</FieldLabel>
            <Input id='idea-title' autoFocus placeholder='Short, descriptive title' value={title} onChange={(e) => setTitle(e.target.value)} minLength={5} maxLength={160} required />
          </Field>
          {similar.length > 0 && (
            <div className='rounded-lg border bg-muted/40 px-3 py-2.5'>
              <p className='mb-1.5 text-xs font-medium text-muted-foreground'>Similar ideas</p>
              <ul className='grid gap-1'>
                {similar.map((post) => (
                  <li key={post.id}>
                    <Link
                      to='/p/$slug/ideas/$postId'
                      params={{ slug, postId: post.id }}
                      onClick={() => onOpenChange(false)}
                      className='flex items-center justify-between gap-3 text-sm hover:text-primary'
                    >
                      <span className='truncate'>{post.title}</span>
                      <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>{post.voteCount} votes</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Field className='gap-2'>
            <FieldLabel id='idea-details-label'>Details</FieldLabel>
            <RichTextEditor
              id='idea-details'
              aria-labelledby='idea-details-label'
              placeholder='What problem would this solve? How would you use it?'
              value={description}
              onChange={setDescription}
            />
          </Field>
          {tags.length > 0 && (
            <Field className='gap-2'>
              <FieldLabel htmlFor='idea-tag'>Category</FieldLabel>
              <Select value={tagId || 'none'} onValueChange={(value) => setTagId(value === 'none' ? '' : value)}>
                <SelectTrigger id='idea-tag' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>No category</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <Dot className={tagDot[tag.color] ?? tagDot.gray} />
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {create.error && <FieldError>{create.error.message}</FieldError>}
        </form>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type='submit' form='new-idea' disabled={create.isPending}>
            {create.isPending && <Spinner />}
            Post idea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
