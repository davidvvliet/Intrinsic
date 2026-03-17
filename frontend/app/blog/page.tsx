"use client";

import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import MobileNavbar from '../components/MobileNavbar';
import Footer from '../components/Footer';
import styles from './page.module.css';

export default function Resources() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return (
    <div className={styles.container}>
      {isMobile ? <MobileNavbar /> : <Navbar />}
      <div className={styles.content}>
        <p className={styles.text}>Articles and case studies coming soon...</p>
      </div>
      <Footer />
    </div>
  );
}
