import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

const FeatureList = [
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "Privacy First",
    description: (
      <>
        Your data stays on your server. No third-party tracking, no external
        dependencies. Complete control over your notes.
      </>
    ),
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: "Easy Deployment",
    description: (
      <>
        Deploy with Docker in minutes. Single container, zero configuration
        complexity. Perfect for self-hosting on your own infrastructure.
      </>
    ),
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: "Modern & Fast",
    description: (
      <>
        Built with Solid.js and Hono for lightning-fast performance. Beautiful
        markdown editor powered by Milkdown with real-time preview.
      </>
    ),
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "Organized",
    description: (
      <>
        Create multiple organizations, organize notes in folders. Color your
        notes to categorize them visually at a glance.
      </>
    ),
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "Milkdown Editor",
    description: (
      <>
        Supports GitHub Flavored Markdown, code blocks with syntax highlighting,
        math equations, tables, and more out of the box.
      </>
    ),
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: "Open Source",
    description: (
      <>
        AGPL-3.0 licensed and fully open source. Inspect the code, contribute
        improvements, or customize it for your needs.
      </>
    ),
  },
];

function Feature({ icon, title, description }) {
  return (
    <div className={clsx("col col--4")}>
      <div className={styles["feature-card"]}>
        <div className={styles["feature-icon"]}>{icon}</div>
        <Heading as="h2" className={styles["feature-title"]}>
          {title}
        </Heading>
        <p className={styles["feature-desc"]}>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.container}>
      <div className={styles["section-header"]}>
        <span className={styles["section-eyebrow"]}>Built for a reason</span>
        <h2 className={styles["section-title"]}>
          Everything you need, nothing you don't
        </h2>
      </div>
      <div className={clsx("container", styles["features-container"])}>
        <div className={clsx("row", styles["features-row-container"])}>
          {FeatureList.slice(0, 3).map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
        <div className={clsx("row", styles["features-row-container"])}>
          {FeatureList.slice(3).map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
