"use client";

import { useState } from 'react';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className={styles.navbar}>
      <div className={styles.logo}>Intrinsic</div>
      <div className={styles.navLinks}>
        <a href="#" className={styles.navLink}>
          How it works
        </a>
        <a href="#" className={styles.navLink}>
          Use cases
        </a>
        <a href="#" className={styles.navLink}>
          FAQ
        </a>
        <a href="#" className={styles.navLink}>
          Pricing
        </a>
      </div>
      <button 
        className={styles.hamburger}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        ☰
      </button>
      <a href="/login" className={styles.signInButton}>
        Sign in
      </a>
    </div>
  );
}
