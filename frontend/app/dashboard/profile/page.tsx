"use client";

import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { useUserPlan } from "../../hooks/useUserPlan";
import DashboardNavbar from "../components/DashboardNavbar";
import styles from "./page.module.css";

export default function ProfilePage() {
  const { user } = useAuth();
  const userPlan = useUserPlan();

  const userName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName || user?.email?.split("@")[0] || "User";

  const handleSignOut = () => {
    window.location.href = '/logout';
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/billing-portal', { method: 'POST' });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error('Failed to open billing portal:', e);
    }
  };


  return (
    <>
      <DashboardNavbar />
      <div className={styles.container}>
        <div className={styles.row1}>
          <h1 className={styles.title}>Profile</h1>
        </div>
        <div className={styles.row2}>
          <div className={styles.profileInfo}>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Name</div>
              <div className={styles.infoValue}>{userName}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Email</div>
              <div className={styles.infoValue}>{user?.email || "N/A"}</div>
            </div>
            {userPlan?.firm_name && (
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Organization</div>
                <div className={styles.infoValue}>{userPlan.firm_name}</div>
              </div>
            )}
            {userPlan?.plan && (
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Plan</div>
                <div className={styles.infoValue}>
                  {userPlan.plan.charAt(0).toUpperCase() + userPlan.plan.slice(1)}
                </div>
              </div>
            )}
            <div className={styles.buttonContainer}>
              <button onClick={handleSignOut} className={styles.signOutButton}>
                Sign out
              </button>
              {userPlan?.plan === 'pro' ? (
                <button onClick={handleManageSubscription} className={styles.manageButton}>
                  Manage subscription
                </button>
              ) : (
                <a href="/pricing" className={styles.manageButton}>
                  Upgrade to Pro
                </a>
              )}
            </div>
          </div>
        </div>
        <div className={styles.row3} />
      </div>
    </>
  );
}
