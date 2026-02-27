import { redirect } from 'next/navigation';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { checkUserAccess } from '../lib/db';
import { SubscriptionProvider } from './contexts/SubscriptionContext';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await withAuth({ ensureSignedIn: true });

  const { hasAccess, plan } = await checkUserAccess(user.email!);

  if (!hasAccess) {
    redirect('/pricing');
  }

  return (
    <SubscriptionProvider plan={plan!}>
      {children}
    </SubscriptionProvider>
  );
}
