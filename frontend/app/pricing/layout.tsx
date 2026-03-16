import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Intrinsic',
  description: 'Simple, transparent pricing for AI-powered financial modeling. Build DCF models, LBOs, and comps with verified SEC data.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'Pricing | Intrinsic',
    description: 'Simple, transparent pricing for AI-powered financial modeling. Build DCF models, LBOs, and comps with verified SEC data.',
    url: 'https://www.runintrinsic.com/pricing',
    siteName: 'Intrinsic',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | Intrinsic',
    description: 'Simple, transparent pricing for AI-powered financial modeling.',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
