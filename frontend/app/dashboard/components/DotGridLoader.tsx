"use client";

import styles from './DotGridLoader.module.css';

export default function DotGridLoader() {
  return (
    <div className={styles.dotGrid}>
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className={styles.dot} />
      ))}
    </div>
  );
}