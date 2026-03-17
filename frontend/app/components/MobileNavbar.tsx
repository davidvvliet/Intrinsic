"use client";

import { useState } from 'react';
import styles from './MobileNavbar.module.css';

export default function MobileNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <div className={styles.navbar}>
        <div className={styles.logo}>Intrinsic</div>
        <button
          className={styles.hamburger}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </div>
      {isMenuOpen && (
        <div className={styles.menu}>
          <a href="/#how-it-works" className={styles.menuItem}>How it works</a>
          <a href="/#use-cases" className={styles.menuItem}>Use cases</a>
          <a href="/#faq" className={styles.menuItem}>FAQ</a>
          <a href="/blog" className={styles.menuItem}>Resources</a>
          <a href="/pricing" className={styles.menuItem}>Pricing</a>
          <a href="/login" className={styles.menuItem}>Sign in</a>
        </div>
      )}
    </>
  );
}
