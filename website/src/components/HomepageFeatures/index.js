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
        Create multiple organizations, organize notes in folders, and use
        full-text search to find what you need instantly. Tag and categorize
        your documents.
      </>
    ),
  },
  {
    title: "Beautiful Editor",
    description: (
      <>
        Write in markdown with a powerful WYSIWYG editor. Supports GitHub
        Flavored Markdown, code blocks with syntax highlighting, math equations,
        tables, and more.
      </>
    ),
  },
  {
    title: "Open Source",
    description: (
      <>
        MIT licensed and fully open source. Inspect the code, contribute
        improvements, or customize it for your needs. No vendor lock-in.
      </>
    ),
  },
];

function Feature({ title, description }) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
