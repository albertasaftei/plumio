<p align="center">
<picture>
    <source srcset="./.github/logo-dark.png" media="(prefers-color-scheme: light)">
    <source srcset="./.github/logo-light.png" media="(prefers-color-scheme: dark)">
    <img src="./.github/logo-dark.png" alt="Header banner">
</picture>
</p>

<h1 align="center">
  plumio
</h1>
<p align="center">
  Self-hosted markdown editor with live preview, document encryption, multi-user support, and multi-organization capabilities.
</p>

<p align="center">
  <a href="https://demo.plumio.app">Demo</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://plumio.app/docs/intro">Docs</a>
</p>

## Introduction

plumio is a self-hosted markdown editor designed for individuals and teams who want a secure, private, and customizable note-taking solution. With features like live preview, document encryption, multi-user support, and multi-organization capabilities, plumio provides a powerful platform for managing your notes and documents.

## Key Features

- **Markdown Editing**: Write and format your notes using markdown syntax with a live preview.
- **Document Encryption**: Keep your notes secure with end-to-end encryption.
- **Colorful Items**: Organize your documents with customizable colors for easy identification.
- **Multi-User Support**: Collaborate with team members by creating multiple user accounts.
- **Multi-Organization Support**: Manage different groups or teams within the same instance.
- **Self-Hosted**: Take full control of your data by hosting plumio on your own server or local machine.

## Getting Started

To get started with plumio, check out our [self-hosting guide](https://plumio.app/docs/self-hosting) for step-by-step instructions on how to set up your own instance. Once you have it up and running, you can start creating and organizing your notes right away!

## Download desktop app

> The desktop app is not signed with an Apple Developer ID or Microsoft certificate, so you may encounter warnings when trying to run it. This is expected for unsigned apps. To run the app, you will need to bypass these warnings:
>
> **macOS**: Go to System Preferences > Security & Privacy > General, scroll down and click "Open Anyway" next to the warning about the app.
>
> **Windows**: When you see the warning, click "More info" and then "Run anyway" to proceed.

You can download the desktop app for Windows and macOS from the [releases page](https://github.com/albertasaftei/plumio/releases).

### IMPORTANT

To connect to your remote server you must add to instance's `ALLOWED_ORIGINS` environment variable the URL of the desktop app: `app://plumio`

## Backup System

plumio includes an optional automated backup system that runs daily to protect your documents. You can enable or disable this feature as needed, and it will create compressed backups of your data while managing retention automatically. Otherwise you can create manual backups at any time and view backup logs to keep track of your backup history. For more details, see the [Backup System documentation](https://plumio.app/docs/configuration#manual-backup).

## Stack

plumio is built using the following technologies:

- **Frontend**
  - **[SolidJS](https://www.solidjs.com)**: A declarative JavaScript library for building user interfaces.
  - **[UnoCSS](https://unocss.dev/)**: An instant on-demand atomic CSS engine.
- **Backend**
  - **[HonoJS (NodeJS)](https://hono.dev/)**: A small, fast, and lightweight web framework for building APIs.
- **Documentation**
  - **[Docusaurus](https://docusaurus.io/)**: A modern static website generator for building documentation websites.

## Contributing

We welcome contributions from the community! If you'd like to contribute to plumio, please read our [contributing guidelines](CONTRIBUTING.md) for more information on how to get involved.

## License

plumio is licensed under the [AGPL-3.0](LICENSE).
