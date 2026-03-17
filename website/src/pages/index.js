import clsx from "clsx";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";
import MarqueeStrip from "@site/src/components/MarqueeStrip";
import ScreenshotCarousel from "@site/src/components/ScreenshotCarousel";
import Heading from "@theme/Heading";
import styles from "./index.module.css";

function HomepageHeader() {
  return (
    <header className={styles["hero-banner"]}>
      <div className={styles["hero-bg-grid"]} aria-hidden="true" />
      <div className={styles["hero-glow"]} aria-hidden="true" />

      <div className={styles["hero-content"]}>
        <div className={styles["hero-badge"]}>v2.4 — Now Available</div>
        <Heading as="h1" className={styles["hero-title"]}>
          Your notes,{" "}
          <em className={styles["hero-title-accent"]}>truly private</em>
        </Heading>
        <p className={styles["hero-subtitle"]}>
          plumio is an open-source, self-hosted note-taking app. Your data lives
          on your server — no tracking, no subscriptions, forever yours.
        </p>
        <div className={styles["hero-buttons"]}>
          <Link
            className={styles["btn-primary"]}
            to="https://demo.plumio.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Try the demo
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link className={styles["btn-secondary"]} to="/docs/intro">
            Read the docs
          </Link>
        </div>
      </div>

      <MarqueeStrip />
      <ScreenshotCarousel />
    </header>
  );
}

function QuickDeploy() {
  return (
    <section className={styles["quick-deploy"]}>
      <div className={styles["qd-inner"]}>
        <div className={styles["qd-text"]}>
          <span className={styles["qd-eyebrow"]}>Get started in minutes</span>
          <h2 className={styles["qd-title"]}>Deploy with Docker</h2>
          <p className={styles["qd-desc"]}>
            One command. Your own server. Full control. No account needed.
          </p>
          <Link className={styles["qd-link"]} to="/docs/intro">
            Full setup guide →
          </Link>
        </div>
        <div
          className={styles["qd-terminal"]}
          aria-label="Docker compose command"
        >
          <div className={styles["qd-terminal-bar"]}>
            <span
              className={styles["qd-dot"]}
              style={{ background: "#ff5f57" }}
            />
            <span
              className={styles["qd-dot"]}
              style={{ background: "#febc2e" }}
            />
            <span
              className={styles["qd-dot"]}
              style={{ background: "#28c840" }}
            />
            <span className={styles["qd-filename"]}>terminal</span>
          </div>
          <pre className={styles["qd-code"]}>
            <code className={styles["qd-code-inner"]}>
              <span className={styles["qd-prompt"]}>$</span>{" "}
              <span className={styles["qd-cmd"]}>curl</span>{" "}
              <span className={styles["qd-arg"]}>
                -O
                https://raw.githubusercontent.com/albertasaftei/plumio/main/docker-compose.yml
              </span>
              {"\n"}
              {"\n"}
              <span className={styles["qd-prompt"]}>$</span>{" "}
              <span className={styles["qd-cmd"]}>docker compose up</span>{" "}
              <span className={styles["qd-flag"]}>-d</span>
              {"\n"}
              {"\n"}
              <span className={styles["qd-comment"]}>
                # ✓ plumio running on http://localhost:3000
              </span>
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="Your private note-taking app"
      description="plumio — Privacy-first, self-hosted note-taking application. Deploy with Docker in minutes."
    >
      <HomepageHeader />
      <main>
        <QuickDeploy />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
