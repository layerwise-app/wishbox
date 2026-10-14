import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Blockquote } from '@tiptap/extension-blockquote';
import { ListItem } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Bold, Italic, Link2, List, ListOrdered, TextQuote } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Toggle } from '~/components/ui/toggle';
import { parseRichText, richTextToHtml, safeHref } from '~/lib/rich-text';
import { docToRichText, richTextToDoc } from '~/lib/rich-text-doc';
import { cn } from '~/lib/utils';

/** Stored rich text. `richTextToHtml` escapes all text and filters links, so the markup is safe to inject. */
export function RichText({ value, className }: { value: string; className?: string }) {
  return <div className={cn('rich-text', className)} dangerouslySetInnerHTML={{ __html: richTextToHtml(parseRichText(value)) }} />;
}

type Format = 'bold' | 'italic' | 'bulletList' | 'orderedList' | 'blockquote' | 'link';

const tools: [Exclude<Format, 'link'>, string, ReactNode, (editor: Editor) => boolean][] = [
  ['bold', 'Bold', <Bold />, (editor) => editor.chain().focus().toggleBold().run()],
  ['italic', 'Italic', <Italic />, (editor) => editor.chain().focus().toggleItalic().run()],
  ['bulletList', 'Bulleted list', <List />, (editor) => editor.chain().focus().toggleBulletList().run()],
  ['orderedList', 'Numbered list', <ListOrdered />, (editor) => editor.chain().focus().toggleOrderedList().run()],
  ['blockquote', 'Quote', <TextQuote />, (editor) => editor.chain().focus().toggleBlockquote().run()]
];

/** A Tiptap editor limited to the formatting stored rich text supports, reporting its content as rich text markdown. */
export function RichTextEditor({ id, value, onChange, placeholder, onSubmitShortcut, ...aria }: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmitShortcut?: () => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  const [linking, setLinking] = useState(false);
  // The value the editor holds, so its own changes don't reset the content and selection.
  const shown = useRef(value);
  // Keyboard shortcuts read the latest handlers; the editor's props are created once.
  const shortcuts = useRef({ submit: onSubmitShortcut, link: () => {} });
  // Options keep their identity across renders so the editor isn't reconfigured on every keystroke.
  const [options] = useState(() => ({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        listItem: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, defaultProtocol: 'https', isAllowedUri: (url) => !!safeHref(url), shouldAutoLink: (url) => !!safeHref(url) }
      }),
      Blockquote.extend({ content: 'paragraph+' }),
      ListItem.extend({
        content: 'paragraph',
        // Lists don't nest, so Tab isn't bound to indenting and moves focus as usual.
        addKeyboardShortcuts() {
          const { Tab, ...shortcuts } = this.parent?.() ?? {};
          return shortcuts;
        }
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' })
    ],
    content: richTextToDoc(value),
    editorProps: {
      // ProseMirror writes every attribute as a string, so unset ones are left out.
      attributes: { ...Object.fromEntries(Object.entries({ id, ...aria }).filter(([, each]) => each)), 'aria-multiline': 'true', class: 'rich-text max-h-96 min-h-24 overflow-y-auto px-3 py-2 text-sm leading-6 outline-none' },
      handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
        if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return false;
        const key = event.key.toLowerCase();
        if (key === 'enter' && shortcuts.current.submit) shortcuts.current.submit();
        else if (key === 'k') shortcuts.current.link();
        // Underline isn't supported, so the browser's own Cmd/Ctrl+U is blocked.
        else if (key !== 'u') return false;
        event.preventDefault();
        return true;
      }
    }
  }));
  const editor = useEditor({
    ...options,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      shown.current = docToRichText(editor.getJSON());
      onChange(shown.current);
    }
  });
  const active = useEditorState({
    editor,
    selector: ({ editor }): Format[] =>
      editor ? (['bold', 'italic', 'bulletList', 'orderedList', 'blockquote', 'link'] as const).filter((format) => editor.isActive(format)) : []
  });

  const startLink = () => {
    if (!editor) return;
    if (editor.isActive('link')) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else setLinking(true);
  };
  const addLink = (href: string) => {
    if (!editor) return;
    if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    else editor.chain().focus().setLink({ href }).run();
  };

  useEffect(() => {
    shortcuts.current = { submit: onSubmitShortcut, link: startLink };
  });
  useEffect(() => {
    // Content set from outside, like a cleared form or a different idea.
    if (!editor || value === shown.current) return;
    shown.current = value;
    editor.commands.setContent(richTextToDoc(value), { emitUpdate: false });
  }, [editor, value]);

  const isLink = !!active?.includes('link');
  return (
    <div className='rounded-md border border-input bg-card shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30'>
      <div className='flex items-center gap-0.5 border-b px-1.5 py-1' role='toolbar' aria-label='Formatting'>
        {tools.map(([format, label, icon, action]) => (
          <Toggle
            key={format}
            size='sm'
            className='size-7 min-w-7 px-0 text-muted-foreground aria-pressed:text-foreground'
            aria-label={label}
            title={label}
            disabled={!editor}
            pressed={!!active?.includes(format)}
            onMouseDown={(event) => event.preventDefault()}
            onPressedChange={() => editor && action(editor)}
          >
            {icon}
          </Toggle>
        ))}
        <Popover open={linking} onOpenChange={setLinking}>
          <PopoverTrigger asChild>
            <Toggle
              size='sm'
              className='size-7 min-w-7 px-0 text-muted-foreground aria-pressed:text-foreground'
              aria-label={isLink ? 'Remove link' : 'Link'}
              title={isLink ? 'Remove link' : 'Link'}
              disabled={!editor}
              pressed={isLink}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                startLink();
              }}
            >
              <Link2 />
            </Toggle>
          </PopoverTrigger>
          <PopoverContent align='start' className='w-72 p-2' onCloseAutoFocus={(event) => event.preventDefault()}>
            <LinkForm
              onSubmit={(href) => {
                setLinking(false);
                addLink(href);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <EditorContent editor={editor} className='min-h-24' />
    </div>
  );
}

function LinkForm({ onSubmit }: { onSubmit: (href: string) => void }) {
  const [value, setValue] = useState('');
  const href = safeHref(/^[a-z][\w+.-]*:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
  return (
    <form
      className='flex gap-1.5'
      onSubmit={(event) => {
        event.preventDefault();
        // React events bubble through the popover portal, so this would also submit the form around the editor.
        event.stopPropagation();
        if (href) onSubmit(href);
      }}
    >
      <Input autoFocus aria-label='Link URL' placeholder='https://' className='h-8' value={value} onChange={(e) => setValue(e.target.value)} />
      <Button type='submit' size='sm' disabled={!value.trim() || !href}>Add</Button>
    </form>
  );
}
