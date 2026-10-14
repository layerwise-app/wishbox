import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AuthCard, AuthForm, redirectSignedIn, validateRedirect } from '~/components/auth-form';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/sign-in')({
  validateSearch: validateRedirect,
  beforeLoad: redirectSignedIn,
  head: () => ({ meta: seo({ title: 'Sign in | Wishbox' }) }),
  component: SignIn
});

function SignIn() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <AuthCard>
      <AuthForm variant='page' description='Manage your feedback boards and roadmaps.' onSuccess={() => void navigate({ href: redirect ?? '/dashboard' })} />
    </AuthCard>
  );
}
