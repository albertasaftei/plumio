---
sidebar_position: 5
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

### Creating Your First Organization

After logging in:

1. Click the organization dropdown in the sidebar
2. Click "Create Organization"
3. Enter a name for your organization
4. Click "Create"

Organizations help you separate different projects, teams, or categories of notes.

---

## Writing Notes

### Creating a New Note

1. Select an organization from the sidebar
2. Click the "+" button or use the keyboard shortcut `Cmd/Ctrl + N`
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

## Organizing Notes

### Folders

Create folders to organize your notes:

1. Right-click in the sidebar
2. Select "New Folder"
3. Enter a folder name
4. Drag and drop notes into folders

### Search

Use the search bar to find notes quickly:

1. Click the search icon or press `Cmd/Ctrl + K`
2. Type your search query
3. Results update in real-time
4. Click a result to open the note

Search looks through:

- Note titles
- Note content
- Folder names

---

## Document Management

### Renaming Notes

1. Right-click on a note in the sidebar
2. Select "Rename"
3. Enter the new name
4. Press Enter

### Moving Notes

Drag and drop notes between folders or organizations.

### Archiving Notes

Archive notes you don't need immediately but want to keep:

1. Right-click on a note
2. Select "Archive"
3. Access archived notes from the Archive view

### Deleting Notes

Soft delete (can be restored):

1. Right-click on a note
2. Select "Delete"
3. Note moves to "Deleted" folder
4. Restore from the Deleted view within 30 days

Permanent delete:

1. Go to Deleted view
2. Right-click on a deleted note
3. Select "Delete Permanently"

:::warning Permanent Deletion
Permanently deleted notes cannot be recovered, even from backups (unless the backup was created before deletion).
:::

---

## Keyboard Shortcuts

### Navigation

- `Cmd/Ctrl + K` - Search
- `Cmd/Ctrl + N` - New note
- `Cmd/Ctrl + B` - Toggle sidebar
- `Cmd/Ctrl + ,` - Settings

### Editing

- `Cmd/Ctrl + B` - Bold
- `Cmd/Ctrl + I` - Italic
- `Cmd/Ctrl + K` - Insert link
- `Cmd/Ctrl + Z` - Undo
- `Cmd/Ctrl + Shift + Z` - Redo
- `Cmd/Ctrl + S` - Save (automatic, but forces save)

### Formatting

- `Cmd/Ctrl + Alt + 1-6` - Headings H1-H6
- `Cmd/Ctrl + Alt + C` - Code block
- `Cmd/Ctrl + Alt + Q` - Quote
- `Tab` - Indent list item
- `Shift + Tab` - Outdent list item

---

## Import & Export

### Exporting Notes

Export your notes for backup or migration:

1. Go to Settings → Import/Export
2. Select "Export"
3. Choose format:
   - **JSON** - Full data including metadata
   - **Markdown** - Plain markdown files
   - **ZIP** - All notes as markdown in a ZIP archive
4. Click "Export"

### Importing Notes

Import notes from other applications:

1. Go to Settings → Import/Export
2. Select "Import"
3. Choose your file (JSON, markdown, or ZIP)
4. Select target organization
5. Click "Import"

Supported import formats:

- plumio JSON exports
- Individual markdown files
- ZIP archives with markdown files
- Standard Note exports (JSON)
- Obsidian vaults (folder structure)

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
- Can manage all organizations
- Access to admin panel

**User**

- Can create and manage own notes
- Can be invited to organizations
- Cannot access admin features

### Inviting Users to Organizations

1. Select an organization
2. Click Settings icon
3. Go to "Members"
4. Click "Invite User"
5. Select user from list
6. Choose permission level (Read, Write, Admin)
7. Click "Invite"

---

## Settings

### Account Settings

**Change Password**

1. Settings → Account
2. Enter current password
3. Enter new password
4. Confirm new password
5. Save

**Profile Information**

1. Settings → Account
2. Update display name
3. Update email (optional)
4. Save changes

---

### Backup Strategy

1. **Enable Automated Backups** (see Configuration guide)
2. **Export Regularly** as additional backup
3. **Test Restore Process** periodically
4. **Keep Backups Off-site** for disaster recovery

## Next Steps

- Learn about [Configuration](/docs/configuration) for advanced setup
- Set up [Backups](/docs/configuration#backup-configuration)
- Explore [Environment Variables](/docs/environment-variables) for customization
