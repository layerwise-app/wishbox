import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dot, tagDot } from '~/components/feedback-ui';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Spinner } from '~/components/ui/spinner';
import { Textarea } from '~/components/ui/textarea';
import { RichTextEditor } from '~/components/rich-text-editor';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import { statusLabels, statuses, type FeedbackStatus, type Post, type Tag } from '~/lib/feedback';
import { updatePost } from '~/lib/feedback.functions';

/** Changes an idea's status or visibility while keeping its other fields. */
export function useQuickUpdate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ post, ...patch }: { post: Post; status?: FeedbackStatus; hidden?: boolean }) =>
      updatePost({
        data: {
          id: post.id,
          title: post.title,
          description: post.description,
          status: patch.status ?? post.status,
          hidden: patch.hidden ?? post.hidden,
          tagIds: post.tags.map((tag) => tag.id),
          message: ''
        }
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['wishbox'] }),
    onError: (error) => toast.error(error.message)
  });
}

export function PostEditor({ post, tags, admin = false, onClose }: { post: Post; tags: Tag[]; admin?: boolean; onClose: () => void }) {
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description);
  const [status, setStatus] = useState(post.status);
  const [hidden, setHidden] = useState(post.hidden);
  const [tagIds, setTagIds] = useState(post.tags.map((tag) => tag.id));
  const [message, setMessage] = useState('');
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => updatePost({ data: { id: post.id, title, description, status, hidden, tagIds, message: status === post.status ? '' : message } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Idea updated');
      onClose();
    }
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold'>Edit idea</DialogTitle>
        </DialogHeader>
        <form
          id='edit-idea'
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field className='gap-2'>
            <FieldLabel htmlFor='edit-title'>Title</FieldLabel>
            <Input id='edit-title' value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={160} />
          </Field>
          <Field className='gap-2'>
            <FieldLabel id='edit-details-label'>Details</FieldLabel>
            <RichTextEditor id='edit-details' aria-labelledby='edit-details-label' value={description} onChange={setDescription} />
          </Field>
          {admin && (
            <>
              <div className='grid grid-cols-2 gap-3'>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='edit-status'>Status</FieldLabel>
                  <Select value={status} onValueChange={(value) => setStatus(value as FeedbackStatus)}>
                    <SelectTrigger id='edit-status' className='w-full'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((item) => <SelectItem key={item} value={item}>{statusLabels[item]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className='gap-2'>
                  <FieldLabel htmlFor='edit-visibility'>Visibility</FieldLabel>
                  <Select value={hidden ? 'hidden' : 'public'} onValueChange={(value) => setHidden(value === 'hidden')}>
                    <SelectTrigger id='edit-visibility' className='w-full'><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='public'>Public</SelectItem>
                      <SelectItem value='hidden'>Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {status !== post.status && (
                <Field className='gap-2'>
                  <FieldLabel htmlFor='edit-note'>Update note</FieldLabel>
                  <Textarea id='edit-note' placeholder='Optional. Shown in the idea’s activity.' value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={2000} />
                </Field>
              )}
              {tags.length > 0 && (
                <Field className='gap-2'>
                  <FieldLabel>Categories</FieldLabel>
                  <ToggleGroup type='multiple' variant='outline' size='sm' spacing={1.5} value={tagIds} onValueChange={setTagIds} className='flex-wrap'>
                    {tags.map((tag) => (
                      <ToggleGroupItem key={tag.id} value={tag.id} className='data-[state=on]:border-primary/40 data-[state=on]:bg-primary/10'>
                        <Dot className={tagDot[tag.color] ?? tagDot.gray} />
                        {tag.name}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
              )}
            </>
          )}
          {save.error && <FieldError>{save.error.message}</FieldError>}
        </form>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>Cancel</Button>
          <Button type='submit' form='edit-idea' disabled={save.isPending}>
            {save.isPending && <Spinner />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
