import styles from "./loading.module.css";

export default function Loading() {
  return (
    <div className={styles.container}>
      <div className={styles.spinner}>
        <div className={styles.ring}></div>
        <span className={styles.logo}>🎓</span>
      </div>
      <p className={styles.text}>Loading Shiksha...</p>
    </div>
  );
}
