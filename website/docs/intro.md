---
sidebar_position: 1
title: Introduction
---

# Welcome to plumio

**plumio** is a self-hosted, privacy-first note-taking application designed for individuals and teams who value data ownership and control. Built with modern web technologies, plumio combines simplicity with powerful features to deliver a seamless note-taking experience.

## Why plumio?

### 🔒 Privacy First

Your notes stay on your server. No third-party tracking, no data mining, no external dependencies. Complete control over your data.

### 🚀 Modern & Fast

Built with cutting-edge technologies:

- **Backend**: Node.js with Hono framework for lightning-fast API responses
- **Frontend**: Solid.js for reactive, performant UI
- **Editor**: Milkdown for a beautiful markdown editing experience
- **Storage**: SQLite for reliable, file-based data persistence

### 🐳 Easy Deployment

Deploy in minutes using Docker. Single container, zero configuration complexity.

### ✨ Feature-Rich

- Real-time markdown editing with live preview
- Organization and folder support
- Full-text search across all notes
- Dark mode support
- Optional end-to-end encryption
- Document archive and soft delete
- Export and import capabilities

## Key Features

### Markdown First

Write in markdown with a powerful WYSIWYG editor powered by Milkdown. Supports:

- GitHub Flavored Markdown (GFM)
- Code blocks with syntax highlighting
- Math equations (KaTeX)
- Tables, task lists, and more

### Organization

- Create multiple organizations
- Organize notes in folders
- Tag and categorize documents
- Quick search and filter

### Security

- JWT-based authentication
- Optional AES-256 encryption for documents
- Bcrypt password hashing
- Secure session management

### Self-Hosted

- Full control over your data
- No external dependencies
- Easy backup and restore
- Docker-based deployment

## Getting Started

Ready to get started? Head over to the [Installation Guide](/docs/installation) to deploy plumio on your server.

## Tech Stack

**Backend**

- [Hono](https://hono.dev/) - Ultra-fast web framework
- [SQLite](https://www.sqlite.org/) via better-sqlite3
- [Jose](https://github.com/panva/jose) for JWT handling
- Node.js 22+

**Frontend**

- [Solid.js](https://www.solidjs.com/) - Reactive JavaScript framework
- [Milkdown](https://milkdown.dev/) - Plugin-driven WYSIWYG editor
- [UnoCSS](https://unocss.dev/) - Instant on-demand atomic CSS
- [Solid Router](https://github.com/solidjs/solid-router) for routing

## Open Source

plumio is open source and licensed under the MIT License. Contributions are welcome!

[View on GitHub](https://github.com/albertasaftei/plumio)
