'use client';

import styles from './TabBar.module.css';

interface Tab {
  id: string;
  title: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  disabled?: boolean;
}

export default function TabBar({ tabs, activeTabId, onTabClick, onTabClose, onNewTab, disabled }: TabBarProps) {
  return (
    <div className={`${styles.tabBar} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.tabsContainer}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
            onClick={() => !disabled && onTabClick(tab.id)}
          >
            <span className={styles.tabTitle}>{tab.title}</span>
            <div className={styles.closeButtonWrapper}>
              <button
                className={styles.closeButton}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) onTabClose(tab.id);
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className={styles.newTabButton} onClick={() => !disabled && onNewTab()}>
        +
      </button>
    </div>
  );
}
