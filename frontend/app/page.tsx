"use client";

import React from 'react';
import pageStyles from './page.module.css';
import Navbar from './components/Navbar';
import MobileNavbar from './components/MobileNavbar';

export default function Landing() {
  return (
    <div id="main-grid-container" className={pageStyles.gridContainer}>
      {/* Row 1: Navbar */}
      <div className={pageStyles.navbarCell}>
        <div className={pageStyles.desktopOnly}>
          <Navbar />
        </div>
        <div className={pageStyles.mobileOnly}>
          <MobileNavbar />
        </div>
      </div>
      
      {/* Row 2: Hero section */}
      <div className={pageStyles.heroSection}>
        <div className={pageStyles.heroText}>Unlock real value</div>
        <div className={pageStyles.heroSubheader}>Automated fundamental analysis with verified SEC data</div>
        <div className={pageStyles.heroButtons}>
          <button className={pageStyles.heroButtonFilled}>Get started</button>
          <button className={pageStyles.heroButtonTransparent}>Book a demo</button>
        </div>
        <img
          src="/intrinsic-dashboard-hero.png"
          alt="Intrinsic Dashboard"
          className={pageStyles.heroImage}
        />
      </div>

      {/* Row 3: Single full-width cell */}
      <div className={pageStyles.row3Cell}></div>

      {/* Row 4: Two cells split vertically (equal width) */}
      <div id="how-it-works" className={pageStyles.row4Container}>
        <div className={pageStyles.row4LeftCell}></div>
        <div className={pageStyles.row4RightCell}></div>
      </div>

      {/* Row 5: Full-width cell */}
      <div className={pageStyles.row5Cell}></div>

      {/* Row 6: Two cells split vertically (reversed proportions) */}
      <div id="use-cases" className={pageStyles.row6LeftCell}>
        <div className={pageStyles.row6LeftInnerCell}></div>
        <div className={pageStyles.row6RightInnerCell}></div>
      </div>

      {/* Row 7: Two cells split vertically (original proportions) */}
      <div className={pageStyles.row7Cell}>
        <div className={pageStyles.row7LeftInnerCell}></div>
        <div className={pageStyles.row7RightInnerCell}></div>
      </div>

      {/* FAQ Row: Full-width cell with side cells and 6 stacked cells */}
      <div id="faq" className={pageStyles.faqRowCell}>
        <div className={pageStyles.faqRowLeftSideCell}></div>
        <div className={pageStyles.faqRowStackedContainer}>
          {[...Array(6)].map((_, index) => (
            <div 
              key={index} 
              className={pageStyles.faqRowStackedItem}
            ></div>
          ))}
        </div>
        <div className={pageStyles.faqRowRightSideCell}></div>
      </div>

      {/* CTA Section: Full-width cell */}
      <div className={pageStyles.ctaSection}></div>

      {/* Footer: Full-width cell */}
      <div className={pageStyles.footerCell}></div>
    </div>
  );
}
