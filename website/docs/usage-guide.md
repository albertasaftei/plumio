---
sidebar_position: 3
title: Usage Guide
---

# Usage Guide

Learn how to use plumio effectively for your note-taking needs.

## First Time Setup

### Creating Your Admin Account

1. Navigate to your plumio instance (e.g., `http://localhost:3000`)
2. You'll be prompted to create an admin account
3. Enter your desired username and a strong password
4. Click "Create Account"

:::tip Password Requirements
Use a strong password with at least 12 characters, including uppercase, lowercase, numbers, and special characters.
:::

---

## Writing Notes

### Creating a New Note

1. Select an organization from the sidebar
2. Click the "+" button
3. Start writing in the editor
4. Your note is automatically saved

### Markdown Editing

plumio supports full markdown syntax:

#### Headings

```markdown
# Heading 1

## Heading 2

### Heading 3
```

#### Text Formatting

```markdown
**Bold text**
_Italic text_
~~Strikethrough~~
`Inline code`
```

#### Lists

```markdown
- Bullet point
- Another point
  - Nested point

1. Numbered list
2. Second item
3. Third item
```

#### Links and Images

```markdown
[Link text](https://example.com)
![Image alt text](https://example.com/image.jpg)
```

#### Code Blocks

````markdown
```javascript
function hello() {
  console.log("Hello, world!");
}
```
````

#### Tables

```markdown
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
```

#### Task Lists

```markdown
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task
```

#### Math Equations

```markdown
Inline math: $E = mc^2$

Block math:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

---

## Import & Export

### Exporting Notes

Export your notes for backup or migration.

The export zip file contains:

- All folders
- All notes in markdown format
- A `metadata.json` file with note/folder metadata (color, favorite)

### Importing Notes

Supported import formats:

- plumio JSON exports
- ZIP archives with markdown files
- Other third party exports that follow the same structure (Obsidian works for example)

:::warning File filtering
When importing a backup, only .md files and folders will be imported. Any hidden or other file types will be ignored.
:::

---

## User Management (Admin)

### Creating Additional Users

As an admin:

1. Go to Settings → Admin Panel
2. Click "Create User"
3. Enter username and password
4. Assign role (User or Admin)
5. Click "Create"

### User Roles

**Admin**

- Full access to all features
- Can create and delete users
- Can manage current organization
- Access to admin panel

### Adding Users to Organizations

Adding users to organizations can be done through the Organization Panel inside the settings. Users can be added through their username.

---

## Settings

### Backup Strategy

1. **Enable Automated Backups** (see Configuration guide)
2. **Export Regularly** as additional backup
3. **Test Restore Process** periodically
4. **Keep Backups Off-site** for disaster recovery

## Next Steps

- Learn about [Configuration](/docs/configuration) for advanced setup
- Set up [Backups](/docs/configuration#backup-configuration)
- Explore [Environment Variables](/docs/environment-variables) for customization
