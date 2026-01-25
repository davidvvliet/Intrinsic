"use client";

import React from 'react';
import DashboardNavbar from './components/DashboardNavbar';
import Globe from './components/Globe';
import { useColumnMinimize } from './hooks/useColumnMinimize';
import styles from './page.module.css';

export default function Dashboard() {
  const columnMinimize = useColumnMinimize();

  return (
    <div className={styles.dashboard}>
      <DashboardNavbar />
      <div 
        className={styles.dashboardContainer}
        style={{ gridTemplateColumns: columnMinimize.getGridTemplateColumns() }}
      >
        {!columnMinimize.leftMinimized && (
          <div className={styles.leftColumn}></div>
        )}
        <div className={styles.middleColumn}>
          <div className={styles.globeContainer}>
            <Globe size={650} color="#000000" speed={0.003} />
          </div>
        </div>
        {!columnMinimize.rightMinimized && (
          <div className={styles.rightColumn}></div>
        )}
        <button
          className={`${styles.minimizeButton} ${
            columnMinimize.leftMinimized 
              ? styles.minimizeButtonLeftMinimized 
              : styles.minimizeButtonLeft
          }`}
          onClick={columnMinimize.toggleLeftColumn}
        >
          {columnMinimize.leftMinimized ? '+' : '−'}
        </button>
        <button
          className={`${styles.minimizeButton} ${
            columnMinimize.rightMinimized 
              ? styles.minimizeButtonRightMinimized 
              : styles.minimizeButtonRight
          }`}
          onClick={columnMinimize.toggleRightColumn}
        >
          {columnMinimize.rightMinimized ? '+' : '−'}
        </button>
      </div>
    </div>
  );
}
