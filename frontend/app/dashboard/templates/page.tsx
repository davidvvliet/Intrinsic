"use client";

import React from 'react';
import DashboardNavbar from '../components/DashboardNavbar';
import styles from './page.module.css';

export default function TemplatesPage() {
  return (
    <div className={styles.container}>
      <DashboardNavbar />
      <h1 className={styles.title}>Templates</h1>
    </div>
  );
}
