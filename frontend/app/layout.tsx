import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Intrinsic | Unlock real value",
  description: "AI-powered fundamental analysis platform that automates DCF modeling and company research using real SEC data.",
  applicationName: 'Intrinsic',
  authors: [{ name: 'MarketRadar Intelligence, Corp.' }],
  category: 'Financial Technology',
  themeColor: '#FFFFE3',
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
    title: "Intrinsic | Unlock real value",
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
    title: "Intrinsic | Unlock real value",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
