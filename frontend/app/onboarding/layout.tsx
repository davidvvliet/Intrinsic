import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Started | Intrinsic',
  description: 'Create your Intrinsic account and start building AI-powered financial models with verified SEC data.',
  alternates: {
    canonical: '/onboarding',
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Get Started | Intrinsic',
    description: 'Create your Intrinsic account and start building AI-powered financial models with verified SEC data.',
    url: 'https://www.runintrinsic.com/onboarding',
    siteName: 'Intrinsic',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get Started | Intrinsic',
    description: 'Create your Intrinsic account and start building AI-powered financial models with verified SEC data.',
  },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
