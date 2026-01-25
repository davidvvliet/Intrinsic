import React from 'react';
import styles from './DashboardNavbar.module.css';

export default function DashboardNavbar() {
  return (
    <div className={styles.navbar}>
      <div className={styles.leftSection}>
        <div className={styles.brand}>Intrinsic</div>
      </div>
      <div className={styles.middleSection}></div>
      <div className={styles.rightSection}>
        <button className={styles.hamburgerButton}>
          ☰
        </button>
      </div>
    </div>
  );
}
