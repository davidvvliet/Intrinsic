"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import pageStyles from './page.module.css';
import Navbar from './components/Navbar';
import MobileNavbar from './components/MobileNavbar';
import Footer from './components/Footer';

const faqData = [
  {
    question: "What is Intrinsic?",
    answer: "Intrinsic is an AI-powered financial modeling platform that builds DCF valuations, LBO analyses, and trading comparables from verified SEC 10-K and 10-Q filings. It combines a fully functional spreadsheet workspace with an AI assistant that understands financial modeling — you describe what you need in plain English and Intrinsic builds the model, fetches the data, and populates every cell."
  },
  {
    question: "What data sources does Intrinsic use?",
    answer: "Intrinsic pulls financial data directly from SEC EDGAR filings — 10-K annual reports and 10-Q quarterly reports. This includes income statement data (revenue, COGS, operating expenses, net income), balance sheet items (assets, liabilities, equity), and cash flow statement data (operating cash flow, capex, free cash flow). All data is sourced from audited filings, not estimated or scraped from third parties. Intrinsic also provides real-time stock quotes."
  },
  {
    question: "Who uses Intrinsic?",
    answer: "Intrinsic is built for equity research analysts, investment banking analysts, portfolio managers, buy-side and sell-side professionals, and finance students who want to build rigorous financial models without spending hours on manual data entry and formatting."
  },
  {
    question: "Can I upload my own Excel models?",
    answer: "Yes. You can upload .xlsx or .csv files directly and Intrinsic will import your data, formulas, and formatting — including bold, colors, number formats, and cell styles. You can also save any workspace as a reusable template, or start from built-in professional templates for DCF, LBO, and trading comps models."
  },
  {
    question: "How does the AI work?",
    answer: "Intrinsic's AI understands financial modeling concepts and spreadsheet structure. You can ask it to build a complete DCF model for any public company, fetch historical financials, add sensitivity tables, format cells, create new sheets, or modify existing formulas — all through natural language. The AI reads your current spreadsheet state and makes precise edits, just like a human analyst would."
  },
  {
    question: "Is my data secure?",
    answer: "Yes. Your models, workspaces, and data are private by default. We use industry-standard encryption, secure authentication via WorkOS, and all data is stored in isolated databases. Your financial models are never shared with other users or used to train AI models."
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
        <p className={pageStyles.heroSubheader}>Automated financial modeling with verified SEC data. Intrinsic is an AI-powered platform that builds DCF models, LBO analyses, trading comps, and custom financial models from real SEC 10-K and 10-Q filings — all inside an interactive spreadsheet workspace.</p>
        <div className={pageStyles.heroButtons}>
          <button className={pageStyles.heroButtonFilled} onClick={() => router.push('/onboarding')}>Get started free</button>
          <button className={pageStyles.heroButtonTransparent} onClick={() => router.push('/pricing')}>See plans</button>
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
            <p>Intrinsic is an AI financial modeling assistant that:</p>
            <ul className={pageStyles.featureList}>
              <li>Builds and edits DCF, LBO, and comps models from natural language instructions</li>
              <li>Works inside a fully functional spreadsheet workspace with formulas, formatting, and multi-sheet support</li>
              <li>Pulls verified financial data directly from SEC 10-K and 10-Q filings — revenue, EBITDA, free cash flow, balance sheet items, and more</li>
            </ul>
            <p>Tell Intrinsic what you need — &quot;build a DCF for Apple using 5 years of historical data&quot; — and it fetches real financials, structures the model, and populates every cell. You focus on the analysis, not the data entry.</p>
          </div>
        </div>
        <div className={pageStyles.row4ImageContainer}>
          <Image src="/intrinsic-workspaces.png" alt="Intrinsic spreadsheet workspace with AI chat panel" width={800} height={600} className={pageStyles.featureImage} />
        </div>
      </section>

      {/* Row 5 */}
      <section id="use-cases" className={pageStyles.row5Cell} aria-label="Multiple workspaces">
        <div className={pageStyles.featureTextCell}>
          <div className={pageStyles.featureHeadingGroup}>
            <h2 className={pageStyles.featureHeroText}>Work across multiple workspaces</h2>
            <p className={pageStyles.featureSubtext}>Organize your financial analysis across separate workspaces — one for each company, deal, or research project. Each workspace has its own sheets, data, and AI conversation history, so your Tesla DCF stays separate from your Meta comps analysis.</p>
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
            <p className={pageStyles.featureSubtext}>Upload your own Excel (.xlsx) or CSV templates, or start from built-in professional models — DCF valuation, leveraged buyout (LBO), and trading comparables. The AI understands your template structure and fills in the right cells with real SEC data, preserving your formulas and formatting.</p>
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
      <Footer />
    </div>
  );
}
