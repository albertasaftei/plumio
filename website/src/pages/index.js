import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";

import Heading from "@theme/Heading";
import styles from "./index.module.css";

function HomepageHeader() {
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          Your self-hosted note-taking app
        </Heading>
        <p className={clsx("hero__subtitle", styles.hero__subtitle)}>
          plumio is an open-source note-taking app designed to help you organize
          and manage your notes with privacy and ease.
        </p>
        <div className={styles.buttons}>
          <Link className="button button--primary button--lg" to="/docs/intro">
            Get Started →
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="https://github.com/albertasaftei/plumio"
            style={{ marginLeft: "1rem" }}
          >
            View on GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`plumio | Self-hosted note-taking app`}
      description="plumio - Privacy-first, self-hosted note-taking application. Deploy with Docker in minutes."
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
