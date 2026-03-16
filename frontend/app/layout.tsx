import type { Metadata } from "next";
import { Geist, Geist_Mono, Inconsolata } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inconsolata = Inconsolata({
  variable: "--font-inconsolata",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: {
    icon: '/icon.svg',
  },
  title: "Intrinsic | Unlock true value",
  description: "AI-powered fundamental analysis platform that automates DCF modeling and company research using real SEC data.",
  applicationName: 'Intrinsic',
  authors: [{ name: 'MarketRadar Intelligence, Corp.' }],
  category: 'Financial Technology',
  themeColor: '#FFFFEF',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Intrinsic',
  },
  keywords: [
    "AI DCF modeling",
    "automated DCF valuation",
    "fundamental analysis platform",
    "SEC data analysis",
    "AI-powered stock research",
    "company valuation tool",
    "automated financial modeling",
    "equity research platform",
    "DCF calculator",
    "stock analysis software",
    "AI investment research",
    "public company analysis",
    "financial statement analysis",
    "intrinsic value calculator",
    "AI valuation models",
    "discounted cash flow",
    "fundamental research automation",
    "SEC filing analysis",
    "company research platform",
    "AI financial analysis",
    "investment analysis tools",
    "stock valuation software",
    "automated equity research",
    "AI-powered valuations",
    "AI stock picker",
  ],
  metadataBase: new URL('https://www.runintrinsic.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Intrinsic | Unlock true value",
    description: "AI-powered fundamental analysis platform that automates DCF modeling and company research using real SEC data.",
    url: 'https://www.runintrinsic.com',
    siteName: 'Intrinsic',
    images: [
      {
        url: '/icon.svg',
        alt: 'Intrinsic - AI-Powered Fundamental Analysis Platform',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Intrinsic | Unlock true value",
    description: "AI-powered fundamental analysis platform that automates DCF modeling and company research using real SEC data.",
    images: ['/icon.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.runintrinsic.com/#organization',
      name: 'Intrinsic',
      legalName: 'MarketRadar Intelligence, Corp.',
      url: 'https://www.runintrinsic.com',
      logo: 'https://www.runintrinsic.com/icon.svg',
      sameAs: ['https://www.linkedin.com/company/intrinsicco'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.runintrinsic.com/#website',
      url: 'https://www.runintrinsic.com',
      name: 'Intrinsic',
      publisher: { '@id': 'https://www.runintrinsic.com/#organization' },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://www.runintrinsic.com/#app',
      name: 'Intrinsic',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      url: 'https://www.runintrinsic.com',
      description: 'AI-powered financial modeling platform that automates DCF, LBO, and comps using verified SEC data.',
      offers: { '@type': 'Offer', url: 'https://www.runintrinsic.com/pricing' },
      publisher: { '@id': 'https://www.runintrinsic.com/#organization' },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inconsolata.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
