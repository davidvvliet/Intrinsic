"use client";

import { useState } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className={styles.navbar} style={{ backgroundColor: 'rgba(255, 255, 239, 0.75)', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}>
      <a href="/" className={styles.logo}>Intrinsic</a>
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
        <a href="/pricing" className={styles.navLink}>
          Pricing
        </a>
      </div>
      <button
        className={styles.hamburger}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        ☰
      </button>
      {user ? (
        <div className={styles.authActions}>
          <span className={styles.userEmail}>Signed in as: {user.email}</span>
          <a href="/dashboard" className={styles.signInButton}>
            Go to dashboard
          </a>
          <a href="/logout" className={styles.logoutButton}>
            Log out
          </a>
        </div>
      ) : (
        <div className={styles.authActions}>
          <a href="/onboarding" className={styles.signInButton}>
            Get started
          </a>
          <a href="/login" className={styles.logoutButton}>
            Sign in
          </a>
        </div>
      )}
    </div>
  );
}
