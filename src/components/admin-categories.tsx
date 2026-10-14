import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dot, EmptyState, ErrorState, PostListSkeleton, tagDot } from '~/components/feedback-ui';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import { tagColors, type Tag } from '~/lib/feedback';
import { createTag, deleteTag, updateTag } from '~/lib/feedback.functions';
import { adminQuery } from '~/lib/queries';

export function AdminCategories({ slug }: { slug: string }) {
  const query = useQuery(adminQuery(slug));
  // `null` is closed, `undefined` tag means a new category.
  const [dialog, setDialog] = useState<{ tag?: Tag } | null>(null);
  const tags = query.data?.tags ?? [];
  const usage = (tag: Tag) => query.data?.posts.filter((post) => !post.mergedIntoId && post.tags.some((item) => item.id === tag.id)).length ?? 0;

  return (
    <div className='grid gap-4'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>{query.data ? `${tags.length} ${tags.length === 1 ? 'category' : 'categories'}` : ''}</p>
        <Button size='sm' onClick={() => setDialog({})}><Plus />New category</Button>
      </div>
      <div className='overflow-hidden rounded-xl border bg-card shadow-xs'>
        {query.isLoading ? (
          <PostListSkeleton rows={2} />
        ) : query.error ? (
          <ErrorState message={query.error.message} retry={() => void query.refetch()} />
        ) : tags.length ? (
          <ul className='divide-y'>
            {[...tags].sort((a, b) => a.name.localeCompare(b.name)).map((tag) => (
              <li key={tag.id} className='flex h-14 items-center gap-3 pr-2 pl-4'>
                <Dot className={tagDot[tag.color] ?? tagDot.gray} />
                <span className='truncate text-sm font-medium'>{tag.name}</span>
                <span className='text-xs text-muted-foreground tabular-nums'>{usage(tag)} {usage(tag) === 1 ? 'idea' : 'ideas'}</span>
                <div className='ml-auto flex items-center'>
                  <Button variant='ghost' size='icon-sm' aria-label={`Edit ${tag.name}`} onClick={() => setDialog({ tag })}><Pencil /></Button>
                  <DeleteCategory slug={slug} tag={tag} usage={usage(tag)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Tags />} title='No categories yet' description='Categories help people file and filter ideas.' />
        )}
      </div>
      {dialog && <CategoryDialog slug={slug} tag={dialog.tag} onClose={() => setDialog(null)} />}
    </div>
  );
}

function DeleteCategory({ slug, tag, usage }: { slug: string; tag: Tag; usage: number }) {
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteTag({ data: { slug, id: tag.id } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success('Category deleted');
    },
    onError: (error) => toast.error(error.message)
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant='ghost' size='icon-sm' aria-label={`Delete ${tag.name}`} className='text-muted-foreground hover:text-destructive'><Trash2 /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{tag.name}”?</AlertDialogTitle>
          {usage > 0 && <AlertDialogDescription>It will be removed from {usage} {usage === 1 ? 'idea' : 'ideas'}.</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant='destructive' onClick={() => remove.mutate()}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CategoryDialog({ slug, tag, onClose }: { slug: string; tag?: Tag; onClose: () => void }) {
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? 'blue');
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () => (tag ? updateTag({ data: { slug, id: tag.id, name, color } }) : createTag({ data: { slug, name, color } })),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['wishbox'] });
      toast.success(tag ? 'Category updated' : 'Category created');
      onClose();
    }
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold'>{tag ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>People pick a category when they post an idea.</DialogDescription>
        </DialogHeader>
        <form
          id='category'
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field className='gap-2'>
            <FieldLabel htmlFor='category-name'>Name</FieldLabel>
            <Input id='category-name' autoFocus placeholder='e.g. Integrations' value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={32} />
          </Field>
          <Field className='gap-2'>
            <FieldLabel>Color</FieldLabel>
            <ToggleGroup type='single' spacing={1} value={color} onValueChange={(value) => value && setColor(value)}>
              {tagColors.map((item) => (
                <ToggleGroupItem key={item} value={item} aria-label={item} className='size-8 rounded-full p-0 data-[state=on]:bg-transparent data-[state=on]:ring-2 data-[state=on]:ring-ring'>
                  <span className={`size-4 rounded-full ${tagDot[item]}`} />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          {save.error && <FieldError>{save.error.message}</FieldError>}
        </form>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>Cancel</Button>
          <Button type='submit' form='category' disabled={save.isPending}>
            {save.isPending && <Spinner />}
            {tag ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
