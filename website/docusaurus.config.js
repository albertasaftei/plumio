// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from "prism-react-renderer";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "plumio",
  tagline: "Self-hosted, privacy-first note-taking",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://plumio.app",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
          routeBasePath: "docs",
          editUrl: "https://github.com/albertasaftei/plumio/edit/main/website/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: "img/plumio-social-card.jpg",
      colorMode: {
        respectPrefersColorScheme: true,
      },
      algolia: {
        appId: "T31WJ0IW61",
        apiKey: "7cd0e11a32d2d192070094a36db2ce2a",
        indexName: "plumio crawler",
      },
      navbar: {
        title: "plumio",
        logo: {
          alt: "",
          src: "img/favicon.svg",
          srcDark: "img/favicon-dark.svg",
          width: 32,
          height: 32,
        },
        hideOnScroll: false,
        items: [
          {
            type: "docSidebar",
            sidebarId: "tutorialSidebar",
            position: "left",
            label: "Documentation",
          },
          {
            href: "https://github.com/albertasaftei/plumio",
            position: "right",
            className: "header-github-link",
            "aria-label": "GitHub repository",
          },
        ],
      },
      footer: {
        links: [
          {
            title: "Documentation",
            items: [
              {
                label: "Getting Started",
                to: "/docs/intro",
              },
              {
                label: "Installation",
                to: "/docs/installation",
              },
              {
                label: "Configuration",
                to: "/docs/configuration",
              },
            ],
          },
          {
            title: "Resources",
            items: [
              {
                label: "GitHub",
                href: "https://github.com/albertasaftei/plumio",
              },
              {
                label: "Issues",
                href: "https://github.com/albertasaftei/plumio/issues",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} plumio.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.shadesOfPurple,
      },
    }),
};

export default config;
