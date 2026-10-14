import { useState, type ReactNode } from 'react';
import { redirect } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '~/components/ui/input-otp';
import { Spinner } from '~/components/ui/spinner';
import { authClient } from '~/lib/auth-client';
import { getAuthSession } from '~/lib/auth.functions';
import { refreshAfterAuth } from '~/lib/queries';

type Mode = 'signin' | 'signup' | 'otp' | 'verify' | 'forgot' | 'reset';

export function AuthForm({ initialMode = 'signin', variant = 'dialog', description = 'Vote, comment, and share ideas.', onSuccess }: {
  initialMode?: 'signin' | 'signup';
  variant?: 'dialog' | 'page';
  /** Shown under the sign-in and sign-up titles. */
  description?: string;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const client = useQueryClient();
  const submit = useMutation({
    mutationFn: async (): Promise<Mode | 'done'> => {
      if (mode === 'otp' || mode === 'forgot') {
        const { error } = mode === 'otp'
          ? await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
          : await authClient.emailOtp.requestPasswordReset({ email });
        if (error) throw new Error(error.message || 'Could not send the code.');
        return mode === 'otp' ? 'verify' : 'reset';
      }
      if (mode === 'reset') {
        const { error } = await authClient.emailOtp.resetPassword({ email, otp: code, password });
        if (error) throw new Error(error.message || 'Could not reset the password.');
      }
      const { error } = mode === 'signup'
        ? await authClient.signUp.email({ email, password, name })
        : mode === 'verify'
          ? await authClient.signIn.emailOtp({ email, otp: code })
          : await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message || 'Could not sign in.');
      return 'done';
    },
    onSuccess: async (result) => {
      if (result !== 'done') {
        setCode('');
        setPassword('');
        setMode(result);
        return;
      }
      await refreshAfterAuth(client);
      onSuccess();
    }
  });
  const changeMode = (next: Mode) => {
    setMode(next);
    submit.reset();
  };

  const title = { signin: 'Sign in', signup: 'Create an account', otp: 'Sign in with a code', verify: 'Check your email', forgot: 'Reset your password', reset: 'Check your email' }[mode];
  const subtitle = {
    signin: description,
    signup: description,
    otp: 'We’ll email you a 6-digit code.',
    forgot: 'We’ll email you a 6-digit code.',
    verify: `Enter the 6-digit code sent to ${email}.`,
    reset: `Enter the code sent to ${email} and choose a new password.`
  }[mode];
  const action = { signin: 'Sign in', signup: 'Create account', otp: 'Send code', verify: 'Verify', forgot: 'Send code', reset: 'Set password' }[mode];
  const coded = mode === 'verify' || mode === 'reset';

  return (
    <div className='grid gap-6'>
      {variant === 'dialog' ? (
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold'>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
      ) : (
        <div className='space-y-1.5 text-center'>
          <h1 className='text-xl font-semibold tracking-tight'>{title}</h1>
          <p className='text-sm text-muted-foreground'>{subtitle}</p>
        </div>
      )}
      <form
        className='grid gap-4'
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        {mode === 'signup' && (
          <Field className='gap-2'>
            <FieldLabel htmlFor='auth-name'>Name</FieldLabel>
            <Input id='auth-name' autoComplete='name' value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} />
          </Field>
        )}
        {!coded && (
          <Field className='gap-2'>
            <FieldLabel htmlFor='auth-email'>Email</FieldLabel>
            <Input id='auth-email' type='email' autoComplete='email' placeholder='you@example.com' value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        )}
        {coded && (
          <InputOTP autoFocus maxLength={6} value={code} onChange={setCode} containerClassName='justify-center'>
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className='size-10 text-base' />)}
            </InputOTPGroup>
          </InputOTP>
        )}
        {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
          <Field className='gap-2'>
            <div className='flex items-center justify-between'>
              <FieldLabel htmlFor='auth-password'>{mode === 'reset' ? 'New password' : 'Password'}</FieldLabel>
              {mode === 'signin' && (
                <button type='button' onClick={() => changeMode('forgot')} className='text-xs text-muted-foreground hover:text-foreground'>
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id='auth-password'
              type='password'
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signin' ? undefined : 'At least 8 characters'}
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        )}
        {submit.error && <FieldError>{submit.error.message}</FieldError>}
        <Button type='submit' size='lg' className='w-full' disabled={submit.isPending || (coded && code.length < 6)}>
          {submit.isPending && <Spinner />}
          {action}
        </Button>
      </form>
      <div className='grid gap-2 text-center text-sm text-muted-foreground'>
        {mode === 'signin' && <TextButton onClick={() => changeMode('otp')}>Email me a sign-in code</TextButton>}
        {(mode === 'otp' || mode === 'verify') && <TextButton onClick={() => changeMode('signin')}>Use a password instead</TextButton>}
        {(mode === 'forgot' || mode === 'reset') ? (
          <TextButton onClick={() => changeMode('signin')}>Back to sign in</TextButton>
        ) : (
          <p>
            {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
            <TextButton onClick={() => changeMode(mode === 'signup' ? 'signin' : 'signup')}>
              {mode === 'signup' ? 'Sign in' : 'Create an account'}
            </TextButton>
          </p>
        )}
      </div>
    </div>
  );
}

function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type='button' onClick={onClick} className='font-medium text-foreground underline-offset-4 hover:underline'>
      {children}
    </button>
  );
}

/** Centered card used by the standalone sign-in pages. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className='flex justify-center px-4 py-10 sm:py-20'>
      <div className='w-full max-w-sm rounded-xl border bg-card p-6 shadow-xs sm:p-8'>{children}</div>
    </div>
  );
}

/** Keeps `?redirect=` to same-origin paths so sign-in can't send people elsewhere. */
export function validateRedirect(search: Record<string, unknown>): { redirect?: string } {
  const value = search.redirect;
  return { redirect: typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined };
}

export async function redirectSignedIn({ search }: { search: { redirect?: string } }) {
  if (await getAuthSession()) throw redirect({ href: search.redirect ?? '/dashboard' });
}
