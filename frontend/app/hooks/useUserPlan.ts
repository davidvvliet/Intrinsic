'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';

export interface UserPlan {
  plan: string | null;
  firm_name: string | null;
  source: string | null;
  stripe_customer_id: string | null;
  status: string | null;
}

export function useUserPlan() {
  const { user } = useAuth();
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/plan')
      .then(r => r.json())
      .then(data => setUserPlan(data))
      .catch(() => {});
  }, [user]);

  return userPlan;
}
