import React from 'react';
import DashboardNavbar from './components/DashboardNavbar';
import styles from './page.module.css';

export default function Dashboard() {
  return (
    <div className={styles.dashboard}>
      <DashboardNavbar />
      <div className={styles.dashboardContainer}>
        <div className={styles.leftColumn}></div>
        <div className={styles.middleColumn}></div>
        <div className={styles.rightColumn}></div>
      </div>
    </div>
  );
}
