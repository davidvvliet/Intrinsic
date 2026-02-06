"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './DashboardNavbar.module.css';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/saved', label: 'Saved' },
  { href: '/dashboard/templates', label: 'Templates' },
];

export default function DashboardNavbar() {
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleSignOut = () => {
    window.location.href = '/logout';
  };

  return (
    <div className={styles.navbar}>
      <div className={styles.leftSection}>
        <div className={styles.brand}>Intrinsic</div>
      </div>
      <div className={styles.middleSection}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href ? styles.navLinkActive : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      <div className={styles.rightSection}>
        <div className={styles.dropdownContainer} ref={dropdownRef}>
          <button 
            className={styles.hamburgerButton}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            ☰
          </button>
          {isDropdownOpen && (
            <div className={styles.dropdown}>
              <button 
                className={styles.signOutButton}
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
