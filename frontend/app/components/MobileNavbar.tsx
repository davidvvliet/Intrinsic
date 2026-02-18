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
          <a href="/login" className={styles.menuItem}>
            Sign in
          </a>
        </div>
      )}
    </>
  );
}
