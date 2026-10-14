import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { UserAvatar } from '~/components/feedback-ui';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { authClient } from '~/lib/auth-client';
import { refreshAfterAuth } from '~/lib/queries';
import { cn } from '~/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 33 35' fill='none' aria-hidden='true' className={className}>
      <path d='M3 8.5 16.5 2 30 8.5v17L16.5 33 3 25.5z' fill='#2563EB' />
      <path d='m3 8.5 13.5 7L30 8.5M16.5 15.5V33' stroke='white' strokeOpacity='.65' strokeWidth='1.8' />
      <path d='m10 5 13.5 7v8l-5-2.5v-8z' fill='#A7C5FF' />
    </svg>
  );
}

const markTones = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-fuchsia-600',
  'from-amber-400 to-orange-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-cyan-400 to-sky-600'
];

/** A project's avatar, or a letter mark colored from its name so it stays the same everywhere. */
export function ProjectMark({ name, src, className }: { name: string; src?: string; className?: string }) {
  // A URL that failed to load falls back to the letter mark.
  const [failed, setFailed] = useState('');
  const tone = markTones[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % markTones.length];
  if (src && src !== failed) {
    return (
      <img
        src={src}
        alt=''
        aria-hidden='true'
        referrerPolicy='no-referrer'
        onError={() => setFailed(src)}
        // A server-rendered image can fail before hydration, when onError isn't listening yet.
        ref={(img) => {
          if (img?.complete && !img.naturalWidth) setFailed(src);
        }}
        className={cn('size-7 shrink-0 rounded-lg bg-card object-cover shadow-xs ring-1 ring-foreground/10', className)}
      />
    );
  }
  return (
    <span aria-hidden='true' className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-sm font-semibold text-white shadow-xs', tone, className)}>
      {[...name.trim()][0]?.toUpperCase() ?? '?'}
    </span>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant='ghost' size='icon-sm' aria-label='Toggle dark mode' onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
      <Sun className='dark:hidden' />
      <Moon className='hidden dark:block' />
    </Button>
  );
}

export function AccountMenu({ user, afterSignOut, children }: { user: { name: string; email: string }; afterSignOut?: () => Promise<unknown>; children?: ReactNode }) {
  const client = useQueryClient();
  const signOut = async () => {
    const { error } = await authClient.signOut();
    if (error) return toast.error(error.message || 'Could not sign out.');
    // Leave private pages first so their queries don't refetch without a session.
    await afterSignOut?.();
    await refreshAfterAuth(client);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50' aria-label='Account menu'>
        <UserAvatar name={user.name} size='default' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        <DropdownMenuLabel className='font-normal'>
          <div className='truncate text-sm font-medium text-foreground'>{user.name}</div>
          <div className='truncate text-xs text-muted-foreground'>{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
        {children && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => void signOut()}><LogOut />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
