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
  title: "Intrinsic | AI-Powered Automated Financial Modeling with Real Data",
  description: "Intrinsic is an AI-powered financial modeling platform that automates DCF valuations, LBO analyses, and trading comps using verified SEC 10-K and 10-Q data. Build, edit, and analyze financial models inside an interactive spreadsheet workspace using natural language — no manual data entry required.",
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
    title: "Intrinsic | AI-Powered Automated Financial Modeling with Real Data",
    description: "Intrinsic is an AI-powered financial modeling platform that automates DCF valuations, LBO analyses, and trading comps using verified SEC 10-K and 10-Q data. Build, edit, and analyze financial models inside an interactive spreadsheet workspace using natural language.",
    url: 'https://www.runintrinsic.com',
    siteName: 'Intrinsic',
    images: [
      {
        url: '/intrinsic-logo.png',
        width: 1200,
        height: 630,
        alt: 'Intrinsic - AI-Powered Fundamental Analysis Platform',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Intrinsic | AI-Powered Automated Financial Modeling with Real Data",
    description: "Intrinsic is an AI-powered financial modeling platform that automates DCF valuations, LBO analyses, and trading comps using verified SEC 10-K and 10-Q data.",
    images: ['/intrinsic-logo.png'],
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
      description: 'Intrinsic is an AI-powered financial modeling platform for equity analysts, investors, portfolio managers, and finance students. It automates the creation of DCF (discounted cash flow) valuations, LBO (leveraged buyout) analyses, and trading comparables using verified data from SEC 10-K and 10-Q filings. Users describe what they want in natural language — for example, "build a 5-year DCF for Apple" — and the AI fetches real financial data (revenue, EBITDA, free cash flow, balance sheet items), structures the model with proper formulas and formatting, and populates every cell inside an interactive spreadsheet workspace. Key features include: multi-sheet workspaces, Excel/CSV template upload and import, built-in professional templates (DCF, LBO, trading comps), real-time AI chat for model editing, cross-sheet formula support, and data sourced directly from SEC EDGAR filings. Intrinsic eliminates manual data entry and lets analysts focus on analysis rather than spreadsheet construction.',
      featureList: 'AI-powered financial model generation, Verified SEC 10-K and 10-Q data, DCF valuation models, LBO analysis models, Trading comparables analysis, Interactive spreadsheet workspace, Natural language model editing, Excel and CSV template upload, Multi-sheet workspaces, Cross-sheet formula support, Real-time stock quotes, Professional built-in templates',
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
