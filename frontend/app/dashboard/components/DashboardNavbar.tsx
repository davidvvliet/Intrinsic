"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './DashboardNavbar.module.css';

export default function DashboardNavbar() {
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
      <div className={styles.middleSection}></div>
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
