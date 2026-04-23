import styles from "./IconButtons.module.css";

export function IconButtons() {
  return (
    <>
      <button type="button" className={styles.btn} title="Notifications" aria-label="Notifications">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2.5c-2.4 0-4.3 1.9-4.3 4.3v2.1c0 .4-.1.9-.4 1.2L2 11.8h12l-1.3-1.7c-.3-.3-.4-.8-.4-1.2V6.8c0-2.4-1.9-4.3-4.3-4.3Z" />
          <path d="M6.4 11.8c0 .9.7 1.7 1.6 1.7s1.6-.8 1.6-1.7" />
        </svg>
        <span className={styles.badge} aria-hidden="true" />
      </button>
      <button type="button" className={styles.btn} title="Settings" aria-label="Settings">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="2.2" />
          <path d="M8 1.4v1.6M8 13v1.6M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M1.4 8H3M13 8h1.6M3.3 12.7l1.1-1.1M11.6 4.4l1.1-1.1" />
        </svg>
      </button>
      <button type="button" className={styles.btn} title="Profile" aria-label="Profile">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="5.5" r="2.6" />
          <path d="M2.8 14c0-2.5 2.3-4.5 5.2-4.5s5.2 2 5.2 4.5" />
        </svg>
      </button>
    </>
  );
}
