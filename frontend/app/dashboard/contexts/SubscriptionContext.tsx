"use client";

import { createContext, useContext } from 'react';

interface SubscriptionContextType {
  plan: string;
}

const SubscriptionContext = createContext<SubscriptionContextType>({ plan: 'free' });

export function SubscriptionProvider({
  plan,
  children,
}: {
  plan: string;
  children: React.ReactNode;
}) {
  return (
    <SubscriptionContext.Provider value={{ plan }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
