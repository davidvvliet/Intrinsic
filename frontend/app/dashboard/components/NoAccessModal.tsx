"use client";

import Image from 'next/image';
import styles from './NoAccessModal.module.css';

interface NoAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  line1: string;
  line2: string;
}

export default function NoAccessModal({ isOpen, onClose, title, line1, line2 }: NoAccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.body}>
          <Image src="/lock-icon.svg" alt="Lock" width={40} height={40} className={styles.lockIcon} />
          <div className={styles.content}>
            <p className={styles.message}>{line1}</p>
            <p className={styles.message}>{line2}</p>
            <a href="/pricing" className={styles.upgradeButton}>
              Upgrade
              <Image src="/arrow.svg" alt="" width={16} height={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
