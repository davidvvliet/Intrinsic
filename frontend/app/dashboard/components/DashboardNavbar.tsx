import React from 'react';
import styles from './DashboardNavbar.module.css';

export default function DashboardNavbar() {
  return (
    <div className={styles.navbar}>
      <div className={styles.logo}>Intrinsic</div>
      <button className={styles.hamburgerButton}>
        ☰
      </button>
    </div>
  );
}
