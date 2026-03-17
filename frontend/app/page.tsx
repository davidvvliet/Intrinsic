"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import pageStyles from './page.module.css';
import Navbar from './components/Navbar';
import MobileNavbar from './components/MobileNavbar';

const faqData = [
  {
    question: "What is Intrinsic?",
    answer: "Intrinsic is an AI-powered financial modeling platform that combines automated spreadsheet generation with verified SEC data. Build, analyze, and share financial models faster than ever before."
  },
  {
    question: "What data sources does Intrinsic use?",
    answer: "Intrinsic pulls from verified SEC filings, earnings reports, and financial databases to ensure your models are built on accurate, up-to-date data."
  },
  {
    question: "Who uses Intrinsic?",
    answer: "Intrinsic is used by analysts, investors, portfolio managers, and finance students who want to build rigorous financial models without spending hours on manual data entry."
  },
  {
    question: "Can I upload my own Excel models?",
    answer: "Yes. You can upload .xlsx or .csv files directly and Intrinsic will import your data and formatting. You can also use our built-in templates to get started quickly."
  },
  {
    question: "How does the AI work?",
    answer: "Intrinsic's AI understands financial concepts and can build or modify models based on natural language instructions. Just describe what you want and it will update the spreadsheet accordingly."
  },
  {
    question: "Is my data secure?",
    answer: "Yes. Your models and data are private by default. We use industry-standard encryption and security practices to keep your work safe."
  }
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqData.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
};

export default function Landing() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
    <div id="main-grid-container" className={pageStyles.gridContainer}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Row 1: Navbar */}
      <div className={pageStyles.navbarCell}>
        <div className={pageStyles.desktopOnly}>
          <Navbar />
        </div>
        <div className={pageStyles.mobileOnly}>
          <MobileNavbar />
        </div>
      </div>

      {/* Row 2: Hero */}
      <section className={pageStyles.heroSection} aria-label="Hero">
        <h1 className={pageStyles.heroText}>Unlock intrinsic value</h1>
        <p className={pageStyles.heroSubheader}>Automated financial modeling with verified SEC data</p>
        <div className={pageStyles.heroButtons}>
          <button className={pageStyles.heroButtonFilled} onClick={() => router.push('/onboarding')}>Get started</button>
          <button className={pageStyles.heroButtonTransparent} onClick={() => router.push('/pricing')}>See pricing</button>
        </div>
        <Image
          src="/intrinsic-dashboard-hero.png"
          alt="Intrinsic AI financial modeling dashboard showing a DCF model and spreadsheet workspace"
          priority
          width={1400}
          height={875}
          className={pageStyles.heroImage}
        />
      </section>

      {/* Row 3: Tagline */}
      <div className={pageStyles.row3Cell} aria-hidden="true"></div>

      {/* Row 4: How it works — text left, image right */}
      <section id="how-it-works" className={pageStyles.row4Cell}>
        <div className={pageStyles.row4Content}>
          <h2 className={pageStyles.row4Heading}>Let intrinsic do the legwork, you make the decisions.</h2>
          <div className={pageStyles.row4Subtext}>
            <p>Intrinsic is an AI that:</p>
            <ul className={pageStyles.featureList}>
              <li>Can build and edit financial models on demand</li>
              <li>Works inside of a fully functional spreadsheet workspace</li>
              <li>Uses verified financial data from any SEC filing</li>
            </ul>
            <p>Describe what you want and Intrinsic does the work. From DCF models to comp tables, intrinsic is always ready.</p>
          </div>
        </div>
        <div className={pageStyles.row4ImageContainer}>
          <Image src="/intrinsic-workspaces.png" alt="Intrinsic spreadsheet workspace with AI chat panel" width={800} height={600} className={pageStyles.featureImage} />
        </div>
      </section>

      {/* Row 5 */}
      <section className={pageStyles.row5Cell} aria-label="Multiple workspaces">
        <div className={pageStyles.featureTextCell}>
          <div className={pageStyles.featureHeadingGroup}>
            <h2 className={pageStyles.featureHeroText}>Work across multiple workspaces</h2>
            <p className={pageStyles.featureSubtext}>Create and manage multiple financial models in different workspaces. Each workspace is a separate project with its own data and models.</p>
          </div>
        </div>
        <div className={pageStyles.featureImageCell}>
          <Image src="/intrinsic-workspaces.png" alt="Multiple financial model workspaces in Intrinsic" width={800} height={600} className={pageStyles.featureImage} />
        </div>
      </section>

      {/* Row 6 */}
      <section className={pageStyles.row6Cell} aria-label="Templates">
        <div className={pageStyles.featureImageCell}>
          <Image src="/intrinsic-templates.png" alt="Library of DCF, LBO, and comps financial model templates in Intrinsic" width={800} height={600} className={pageStyles.featureImage} />
        </div>
        <div className={pageStyles.featureTextCellRight}>
          <div className={pageStyles.featureHeadingGroup}>
            <h2 className={pageStyles.featureHeroText}>Upload your preferred templates</h2>
            <p className={pageStyles.featureSubtext}>Upload your own templates or choose from a library of professional financial models. DCF, LBO, comps, and more, pre-built and ready to customize with real data.</p>
          </div>
        </div>
      </section>

      {/* Row 8 */}
      <div id="faq" className={pageStyles.row8Cell}>
        <h2 className={pageStyles.row8Text}>Frequently asked questions.</h2>
      </div>

      {/* Row 9: FAQ stacked grid */}
      <section className={pageStyles.faqRowCell} aria-label="Frequently asked questions">
        <div className={pageStyles.faqRowLeftSideCell} aria-hidden="true"></div>
        <div className={pageStyles.faqAccordion}>
          {faqData.map((faq, index) => (
            <div
              key={index}
              className={pageStyles.faqItem}
              onClick={() => setOpenFaq(openFaq === index ? null : index)}
              role="button"
              tabIndex={0}
              aria-expanded={openFaq === index}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenFaq(openFaq === index ? null : index); }}
            >
              <div className={pageStyles.faqQuestion}>
                <span>{faq.question}</span>
                <span className={pageStyles.faqChevron} aria-hidden="true">{openFaq === index ? '−' : '+'}</span>
              </div>
              {openFaq === index && (
                <p className={pageStyles.faqAnswer}>{faq.answer}</p>
              )}
            </div>
          ))}
        </div>
        <div className={pageStyles.faqRowRightSideCell} aria-hidden="true"></div>
      </section>

      {/* Row 10: CTA */}
      <section className={pageStyles.ctaSection} aria-label="Call to action">
        <h2 className={pageStyles.ctaText}>Ready to model smarter?</h2>
        <button className={pageStyles.ctaButton} onClick={() => router.push('/onboarding')}>Get started free</button>
      </section>

      {/* Row 11: Footer */}
      <footer className={pageStyles.footerCell}>
        <div className={pageStyles.footerContent}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <a href="/" className={pageStyles.footerLogo}>Intrinsic</a>
            <a href="https://www.linkedin.com/company/intrinsicco" target="_blank" rel="noopener noreferrer" className={pageStyles.linkedinLink}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#0A66C2" style={{ display: 'block' }}>
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          </div>
          <span className={pageStyles.footerCopy}>© 2026 Intrinsic. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
