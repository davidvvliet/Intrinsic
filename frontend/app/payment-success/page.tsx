import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

export default function PaymentSuccess() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.message}>
          <Image
            src="/green-check-mark-verified-circle-16223.svg"
            alt="success"
            width={28}
            height={28}
          />
          Payment successful
        </div>
        <Link href="/dashboard" className={styles.dashboardButton}>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
