"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useUserPlan } from '../hooks/useUserPlan';
import Navbar from '../components/Navbar';
import MobileNavbar from '../components/MobileNavbar';
import Footer from '../components/Footer';
import styles from './page.module.css';

export default function Pricing() {
  const { user } = useAuth();
  const currentPlan = useUserPlan();
  const [isMobile, setIsMobile] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [submitting, setSubmitting] = useState<'pro' | 'free' | null>(null);

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

  const triggerCheckout = async (period: 'monthly' | 'yearly') => {
    setSubmitting('pro');
    try {
      const priceId = period === 'monthly'
        ? process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
        : process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID;

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Stripe checkout error:', data.error);
        setSubmitting(null);
      }
    } catch (e) {
      console.error('Stripe checkout error:', e);
      setSubmitting(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    const match = document.cookie.match(/(?:^|; )checkout_intent=([^;]*)/);
    if (!match) return;
    try {
      const intent = JSON.parse(decodeURIComponent(match[1]));
      document.cookie = 'checkout_intent=; max-age=0; path=/';
      triggerCheckout(intent.billingPeriod || 'yearly');
    } catch {
      document.cookie = 'checkout_intent=; max-age=0; path=/';
    }
  }, [user]);

  const handleProPlan = async () => {
    if (!user) {
      document.cookie = `checkout_intent=${encodeURIComponent(JSON.stringify({ billingPeriod }))}; max-age=300; path=/`;
      window.location.href = '/signup';
      return;
    }
    if (currentPlan?.source === 'stripe' && currentPlan?.stripe_customer_id) {
      setSubmitting('pro');
      try {
        const response = await fetch('/api/stripe/billing-portal', { method: 'POST' });
        const data = await response.json();
        if (data.url) window.location.href = data.url;
      } catch (e) {
        console.error('Billing portal error:', e);
      } finally {
        setSubmitting(null);
      }
      return;
    }
    await triggerCheckout(billingPeriod);
  };

  const handleFreePlan = async () => {
    setSubmitting('free');
    try {
      await fetch('/api/user/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'free' }),
      });
      window.location.href = '/dashboard';
    } catch (e) {
      console.error('Free plan error:', e);
      setSubmitting(null);
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
                  <span>100 messages per month</span>
                </li>
                <li className={styles.featureItem}>
                  <span className={styles.checkIcon}>&#10003;</span>
                  <span>Our core valuation templates</span>
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
                className={`${styles.subscribeButton} ${currentPlan?.plan === 'free' ? styles.currentPlanButton : ''}`}
                onClick={handleFreePlan}
                disabled={submitting !== null || currentPlan?.plan === 'free'}
              >
                {submitting === 'free' ? 'Setting up...' : currentPlan?.plan === 'free' ? 'Current plan' : 'Select'}
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
                className={`${styles.subscribeButton} ${currentPlan?.plan === 'pro' ? styles.currentPlanButton : ''}`}
                onClick={handleProPlan}
                disabled={submitting !== null || currentPlan?.plan === 'pro'}
              >
                {submitting === 'pro' ? 'Setting up...' : currentPlan?.plan === 'pro' ? 'Current plan' : 'Select'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
