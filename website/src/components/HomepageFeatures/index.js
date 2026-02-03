import clsx from "clsx";
import Heading from "@theme/Heading";
import styles from "./styles.module.css";

const FeatureList = [
  {
    title: "Privacy First",
    description: (
      <>
        Your data stays on your server. No third-party tracking, no external
        dependencies. Complete control over your notes with optional end-to-end
        encryption.
      </>
    ),
  },
  {
    title: "Easy Deployment",
    description: (
      <>
        Deploy with Docker in minutes. Single container, zero configuration
        complexity. Perfect for self-hosting on your own infrastructure.
      </>
    ),
  },
  {
    title: "Modern & Fast",
    description: (
      <>
        Built with Solid.js and Hono for lightning-fast performance. Beautiful
        markdown editor powered by Milkdown with real-time preview and syntax
        highlighting.
      </>
    ),
  },
  {
    title: "Organized",
    description: (
      <>
        Create multiple organizations, organize notes in folders. Color your
        notes to categorize them visually.
      </>
    ),
  },
  {
    title: "Milkdown Editor",
    description: (
      <>
        Supports GitHub Flavored Markdown, code blocks with syntax highlighting,
        math equations, tables, and more.
      </>
    ),
  },
  {
    title: "Open Source",
    description: (
      <>
        AGPL-3.0 licensed and fully open source. Inspect the code, contribute
        improvements, or customize it for your needs.
      </>
    ),
  },
];

function Feature({ title, description }) {
  return (
    <div className={clsx("col col--4")}>
      <div className={clsx("padding-horiz--md", styles.feature_card)}>
        <Heading as="h2" className={"text--primary"}>
          {title}
        </Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={clsx(styles.container)}>
      <div className={clsx("row margin-top--lg", styles.features_container)}>
        <Feature
          title={FeatureList[0].title}
          description={FeatureList[0].description}
        />
        <Feature
          title={FeatureList[1].title}
          description={FeatureList[1].description}
        />
        <Feature
          title={FeatureList[2].title}
          description={FeatureList[2].description}
        />
      </div>
      <div className={clsx("row margin-bottom--lg", styles.features_container)}>
        <Feature
          title={FeatureList[3].title}
          description={FeatureList[3].description}
        />
        <Feature
          title={FeatureList[4].title}
          description={FeatureList[4].description}
        />
        <Feature
          title={FeatureList[5].title}
          description={FeatureList[5].description}
        />
      </div>
    </section>
  );
}
