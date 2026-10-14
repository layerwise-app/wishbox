import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AuthCard, AuthForm, redirectSignedIn, validateRedirect } from '~/components/auth-form';
import { seo } from '~/utils/seo';

export const Route = createFileRoute('/_site/sign-up')({
  validateSearch: validateRedirect,
  beforeLoad: redirectSignedIn,
  head: () => ({ meta: seo({ title: 'Create an account | Wishbox' }) }),
  component: SignUp
});

function SignUp() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <AuthCard>
      <AuthForm variant='page' initialMode='signup' description='Manage your feedback boards and roadmaps.' onSuccess={() => void navigate({ href: redirect ?? '/dashboard' })} />
    </AuthCard>
  );
}
