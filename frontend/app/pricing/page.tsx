"use client";

import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import MobileNavbar from '../components/MobileNavbar';
import Footer from '../components/Footer';
import styles from './page.module.css';

export default function Pricing() {
  const [isMobile, setIsMobile] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )onboarding_data=([^;]*)/);
    if (!match) return;
    try {
      const data = JSON.parse(decodeURIComponent(match[1]));
      document.cookie = 'onboarding_data=; max-age=0; path=/';
      fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    } catch {
      document.cookie = 'onboarding_data=; max-age=0; path=/';
    }
  }, []);

  const handleFreePlan = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/user/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'free' }),
      });
      window.location.href = '/dashboard';
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {isMobile ? <MobileNavbar /> : <Navbar />}
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Choose your plan</h1>
        </div>
        <div className={styles.toggleContainer}>
          <button
            className={`${styles.toggleOption} ${billingPeriod === 'monthly' ? styles.toggleOptionActive : ''}`}
            onClick={() => setBillingPeriod('monthly')}
          >
            Monthly
          </button>
          <button
            className={`${styles.toggleOption} ${billingPeriod === 'yearly' ? styles.toggleOptionActive : ''}`}
            onClick={() => setBillingPeriod('yearly')}
          >
            Yearly (save 20%)
          </button>
        </div>
        <div className={styles.cardsContainer}>
          <div className={styles.card}>
            <h2 className={`${styles.cardTitle} ${styles.cardTitleWithPadding}`}>Free</h2>
            <div className={styles.cardContent}>
              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>Automated financial models from SEC filings</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>5 models per month</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>Basic valuation templates</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>1 workspace</span>
                </li>
              </ul>
              <div className={styles.priceContainer}>
                <div className={styles.price}>$0</div>
                <div className={styles.priceLabel}>
                  <div>per</div>
                  <div>month</div>
                </div>
              </div>
              <button
                className={styles.subscribeButton}
                onClick={handleFreePlan}
                disabled={submitting}
              >
                {submitting ? 'Setting up...' : 'Select'}
              </button>
            </div>
          </div>
          <div className={`${styles.card} ${styles.highlightedCard}`}>
            <div className={styles.mostPopular}>Most popular</div>
            <h2 className={styles.cardTitle}>Pro</h2>
            <div className={styles.cardContent}>
              <div className={styles.includedText}>Everything in Free +</div>
              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>Unlimited financial models</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>AI-powered analysis and insights</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>All valuation templates</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>Unlimited workspaces</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>Export to Excel</span>
                </li>
              </ul>
              <div className={styles.priceContainer}>
                <div className={styles.priceWrapper}>
                  {billingPeriod === 'yearly' && <span className={styles.originalPrice}>$29</span>}
                  <div className={styles.price}>{billingPeriod === 'monthly' ? '$29' : '$23'}</div>
                </div>
                <div className={styles.priceLabel}>
                  <div>per</div>
                  <div>month</div>
                </div>
              </div>
              <button
                className={styles.subscribeButton}
              >
                Select
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
