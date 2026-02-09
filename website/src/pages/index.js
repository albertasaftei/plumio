import clsx from "clsx";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";

import Heading from "@theme/Heading";
import styles from "./index.module.css";

function HomepageHeader() {
  return (
    <header className={clsx("hero", styles["hero-banner"])}>
      <div
        className="container"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          className={clsx(
            "lg:margin-bottom--xl",
            styles["hero-text__container"],
          )}
        >
          <Heading as="h1" className="">
            Your private note-taking app
          </Heading>
          <Heading as="h2" className={clsx(styles["hero__subtitle"])}>
            plumio is an open-source note-taking app designed to help you
            organize and manage your notes with privacy and ease.
          </Heading>
          <div className={styles.buttons}>
            <Link
              className="button button--secondary button--lg"
              to="https://demo.plumio.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              Live demo
            </Link>
            <Link
              className="button button--primary button--lg"
              to="/docs/intro"
            >
              Get Started
            </Link>
          </div>
        </div>
        <div className={styles["hero-image__container"]}>
          <img
            src="/img/app-preview.png"
            alt="plumio app preview"
            className={styles["preview-image"]}
          />
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <Layout
      title={`Your private note-taking app`}
      description="plumio - Privacy-first, self-hosted note-taking application. Deploy with Docker in minutes."
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
