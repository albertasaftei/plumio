import styles from "./styles.module.css";

const marqueeItems = [
  "Open Source",
  "Privacy First",
  "Docker Ready",
  "AGPL-3.0",
  "Self-Hosted",
  "Markdown Editor",
  "Multi-Organization",
  "Zero Vendor Lock-in",
  "No Tracking",
  "Your Data, Your Rules",
];

export default function MarqueeStrip() {
  return (
    <div className={styles["marquee-container"]}>
      <div className={styles["marquee-track"]}>
        {[...marqueeItems, ...marqueeItems].map((item, i) => (
          <span key={i} className={styles["marquee-item"]}>
            <span className={styles["marquee-dot"]}>◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
