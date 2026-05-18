---
sidebar_position: 7
title: API Endpoints
---

# API Endpoints

plumio exposes a REST API that lets you interact with your notes, folders, tags, and attachments programmatically from any external tool, script, or integration.

---

## Authentication

The API uses **Bearer token** authentication. All requests must include your API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

API keys start with the prefix `plm_`.

### Creating an API Key

1. Open plumio and go to **Settings → API Keys**
2. Click **Create API Key**
3. Give it a descriptive name (e.g. `backup-script`, `zapier-integration`)
4. Set an optional expiry date
5. Select the permissions you need
6. Click **Create** — copy the key immediately, it is shown only once

### Organization Context

API keys are not tied to a specific organization at creation time. When making requests, you must specify which organization to operate on by including the `X-Org-Id` header with the numeric organization ID:

```
X-Org-Id: 1
```

You can find your organization ID in the URL when using the plumio web app.

### Permissions

When creating an API key, select only the permissions your use case requires:

| Permission         | Description                                        |
| ------------------ | -------------------------------------------------- |
| `documents:read`   | List, search, and read document content            |
| `documents:create` | Create new documents and import content            |
| `documents:update` | Edit, rename, move, archive, and restore documents |
| `documents:delete` | Permanently delete documents                       |
| `folders:read`     | List and browse the folder tree                    |
| `folders:create`   | Create new folders                                 |
| `folders:update`   | Rename, move, and reorder folders                  |
| `folders:delete`   | Permanently delete folders                         |
| `tags:read`        | List tags and their document associations          |
| `tags:create`      | Create new tags and assign them to documents       |
| `tags:update`      | Edit tag name, color, and description              |
| `tags:delete`      | Delete tags                                        |

:::note
API key management endpoints (list, create, revoke) require a regular user session and **cannot** be called with an API key.
:::

### Examples

Using cURL:

```bash
curl https://your-plumio-instance.com/api/documents/list \
  -H "Authorization: Bearer plm_your_api_key_here" \
  -H "X-Org-Id: 1"
```

Using JavaScript (fetch):

```js
const response = await fetch(
  "https://your-plumio-instance.com/api/documents/list",
  {
    headers: {
      Authorization: "Bearer plm_your_api_key_here",
      "X-Org-Id": "1",
      "Content-Type": "application/json",
    },
  },
);
const data = await response.json();
```

---

## Endpoints

### Documents

#### List documents and folders

`GET /api/documents/list`

Returns the contents of a folder. Supports recursive tree loading.

- **Required permission:** `documents:read` or `folders:read`
- **Query parameters**
  - `path` — (optional, default: `/`) The folder path to list
  - `recursive` — (optional) Set to `true` to return the full subtree
- **Response (JSON)**
  - `items` — Array of document and folder objects

---

#### Get document content

`GET /api/documents/content`

Returns the raw markdown content of a document.

- **Required permission:** `documents:read`
- **Query parameters**
  - `path` — The document path (e.g. `/my-note.md`)
- **Response (JSON)**
  - `content` — The document's markdown content
  - `path` — The document path

---

#### Search documents

`GET /api/documents/search`

Full-text search across all documents in the organization.

- **Required permission:** `documents:read`
- **Query parameters**
  - `q` — The search query string
- **Response (JSON)**
  - `results` — Array of matching document objects

---

#### Create or update a document

`POST /api/documents/save`

Creates a new document or overwrites an existing one.

- **Required permission:** `documents:create` (new) or `documents:update` (existing)
- **Body (JSON)**
  - `content` — The markdown content
  - `folder` — The parent folder path (e.g. `/notes`)
  - `name` — The file name without extension (e.g. `my-note`)
- **Response (JSON)**
  - `message` — Success message
  - `path` — The final path of the saved document

---

#### Import documents

`POST /api/documents/import`

Import documents from an exported plumio archive.

- **Required permission:** `documents:create`
- **Body (multipart/form-data)**
  - `file` — The `.tar.gz` archive file
- **Response (JSON)**
  - `message` — Success message

---

#### Export documents (encrypted)

`POST /api/documents/export`

Export all documents as an encrypted `.tar.gz` archive.

- **Required permission:** `documents:read`
- **Response:** Binary `.tar.gz` file stream

---

#### Export documents (plain)

`POST /api/documents/export-plain`

Export all documents as a plain (decrypted) `.tar.gz` archive.

- **Required permission:** `documents:read`
- **Response:** Binary `.tar.gz` file stream

---

#### Duplicate a document or folder

`POST /api/documents/duplicate`

Creates a copy of a document or folder.

- **Required permission:** `documents:create` or `folders:create`
- **Body (JSON)**
  - `path` — The path of the item to duplicate
- **Response (JSON)**
  - `message` — Success message

---

#### Rename a document or folder

`POST /api/documents/rename`

Renames a document or folder in place.

- **Required permission:** `documents:update` or `folders:update`
- **Body (JSON)**
  - `path` — Current path
  - `newName` — New file or folder name
- **Response (JSON)**
  - `message` — Success message
  - `newPath` — The new path after rename

---

#### Move a document or folder

`POST /api/documents/move`

Moves a document or folder to a different parent folder within the same organization.

- **Required permission:** `documents:update` or `folders:update`
- **Body (JSON)**
  - `sourcePath` — Path of the item to move
  - `destinationFolder` — Target folder path
- **Response (JSON)**
  - `message` — Success message

---

#### Move to another organization

`POST /api/documents/move-cross-org`

Moves an item to the root of a different organization.

- **Required permission:** `documents:update` or `folders:update`
- **Body (JSON)**
  - `sourcePath` — Path of the item to move
  - `targetOrgId` — ID of the destination organization
  - `keepSource` — (optional, boolean) Keep a copy in the source org
- **Response (JSON)**
  - `message` — Success message

---

#### Reorder items

`POST /api/documents/reorder`

Changes the sort order of a document or folder (drag-and-drop reordering).

- **Required permission:** `documents:update` or `folders:update`
- **Body (JSON)**
  - `sourcePath` — Path of the item being moved
  - `targetPath` — Path of the reference item
  - `operation` — `"before"` or `"after"`
- **Response (JSON)**
  - `message` — Success message

---

#### Toggle favorite

`POST /api/documents/favorite`

Sets or removes the favorite flag on a document or folder.

- **Required permission:** `documents:update`
- **Body (JSON)**
  - `path` — The item path
  - `favorite` — `true` to mark as favorite, `false` to remove
- **Response (JSON)**
  - `message` — Success message

---

#### Set color

`POST /api/documents/color`

Sets or clears the color label on a document or folder.

- **Required permission:** `documents:update`
- **Body (JSON)**
  - `path` — The item path
  - `color` — A hex color string (e.g. `#f59e0b`) or `null` to clear
- **Response (JSON)**
  - `message` — Success message

---

#### Delete a document or folder

`DELETE /api/documents/delete`

Soft-deletes a document or folder (moves it to the Recently Deleted bin, recoverable for 30 days).

- **Required permission:** `documents:delete` or `folders:delete`
- **Query parameters**
  - `path` — The item path to delete
- **Response (JSON)**
  - `message` — Success message

---

#### List recently deleted

`GET /api/documents/deleted`

Returns all items currently in the Recently Deleted bin.

- **Required permission:** `documents:read`
- **Response (JSON)**
  - `items` — Array of deleted document objects

---

#### Restore a deleted document

`POST /api/documents/deleted/restore`

Restores a document from the Recently Deleted bin to its original location.

- **Required permission:** `documents:update`
- **Body (JSON)**
  - `path` — The deleted document path (includes `.deleted-{timestamp}` suffix)
- **Response (JSON)**
  - `success` — `true`
  - `restoredPath` — The restored document path

---

#### Permanently delete

`POST /api/documents/deleted/permanent`

Permanently deletes a document from the Recently Deleted bin. This action is irreversible.

- **Required permission:** `documents:delete`
- **Body (JSON)**
  - `path` — The deleted document path
- **Response (JSON)**
  - `message` — Success message

---

#### Archive a document

`POST /api/documents/archive`

Archives a document (removes it from the main view without deleting it).

- **Required permission:** `documents:update`
- **Body (JSON)**
  - `path` — The document path to archive
- **Response (JSON)**
  - `message` — Success message

---

#### Unarchive a document

`POST /api/documents/unarchive`

Restores an archived document back to the main document tree.

- **Required permission:** `documents:update`
- **Body (JSON)**
  - `path` — The archived document path (includes `.archived-{timestamp}` suffix)
- **Response (JSON)**
  - `message` — Success message

---

#### List archived documents

`GET /api/documents/archived`

Returns all archived documents for the organization.

- **Required permission:** `documents:read`
- **Response (JSON)**
  - `items` — Array of archived document objects

---

#### Permanently delete an archived document

`POST /api/documents/archive/delete`

Permanently removes a document from the archive. This action is irreversible.

- **Required permission:** `documents:delete`
- **Body (JSON)**
  - `path` — The archived document path
- **Response (JSON)**
  - `message` — Success message

---

---

### Folders

#### List folder contents

`GET /api/documents/list`

Returns the items inside a folder. Same endpoint as document listing — use the `folders:read` permission when you only need to navigate the folder tree without reading document content.

- **Required permission:** `folders:read` or `documents:read`
- **Query parameters**
  - `path` — (optional, default: `/`) The folder path to list
  - `recursive` — (optional) Set to `true` to return the full subtree
- **Response (JSON)**
  - `items` — Array of folder and document objects

---

#### Create a folder

`POST /api/documents/folder`

Creates a new folder.

- **Required permission:** `folders:create`
- **Body (JSON)**
  - `folder` — Parent folder path (e.g. `/projects`)
  - `name` — New folder name
- **Response (JSON)**
  - `message` — Success message
  - `path` — The created folder path

---

#### Rename a folder

`POST /api/documents/rename`

Renames a folder in place.

- **Required permission:** `folders:update`
- **Body (JSON)**
  - `path` — Current folder path
  - `newName` — New folder name
- **Response (JSON)**
  - `message` — Success message
  - `newPath` — The new path after rename

---

#### Move a folder

`POST /api/documents/move`

Moves a folder to a different parent folder within the same organization.

- **Required permission:** `folders:update`
- **Body (JSON)**
  - `sourcePath` — Path of the folder to move
  - `destinationFolder` — Target parent folder path
- **Response (JSON)**
  - `message` — Success message

---

#### Move folder to another organization

`POST /api/documents/move-cross-org`

Moves a folder (and all its contents) to the root of a different organization.

- **Required permission:** `folders:update`
- **Body (JSON)**
  - `sourcePath` — Path of the folder to move
  - `targetOrgId` — ID of the destination organization
  - `keepSource` — (optional, boolean) Keep a copy in the source org
- **Response (JSON)**
  - `message` — Success message

---

#### Duplicate a folder

`POST /api/documents/duplicate`

Creates a full copy of a folder and all its contents.

- **Required permission:** `folders:create`
- **Body (JSON)**
  - `path` — The folder path to duplicate
- **Response (JSON)**
  - `message` — Success message

---

#### Reorder folders

`POST /api/documents/reorder`

Changes the sort position of a folder relative to another item (drag-and-drop reordering).

- **Required permission:** `folders:update`
- **Body (JSON)**
  - `sourcePath` — Path of the folder being moved
  - `targetPath` — Path of the reference item
  - `operation` — `"before"` or `"after"`
- **Response (JSON)**
  - `message` — Success message

---

#### Delete a folder

`DELETE /api/documents/delete`

Soft-deletes a folder and all its contents (moved to the Recently Deleted bin).

- **Required permission:** `folders:delete`
- **Query parameters**
  - `path` — The folder path to delete
- **Response (JSON)**
  - `message` — Success message

---

### Tags

#### List tags

`GET /api/tags`

Returns all tags for the authenticated user within the current organization.

- **Required permission:** `tags:read`
- **Response (JSON)**
  - `tags` — Array of tag objects (includes document counts)

---

#### Create a tag

`POST /api/tags`

Creates a new tag.

- **Required permission:** `tags:create`
- **Body (JSON)**
  - `name` — Tag name (must be unique within the org)
  - `color` — (optional) Hex color string (e.g. `#10b981`)
  - `description` — (optional) Short description
- **Response (JSON, 201)**
  - `tag` — The created tag object

---

#### Update a tag

`PUT /api/tags/:id`

Updates a tag's name, color, or description.

- **Required permission:** `tags:update`
- **Body (JSON)**
  - `name` — (optional) New tag name
  - `color` — (optional) New hex color string
  - `description` — (optional) New description
- **Response (JSON)**
  - `tag` — The updated tag object

---

#### Delete a tag

`DELETE /api/tags/:id`

Permanently deletes a tag and removes it from all associated documents.

- **Required permission:** `tags:delete`
- **Response (JSON)**
  - `message` — Success message

---

#### Get documents for a tag

`GET /api/tags/:id/documents`

Returns all documents that have a given tag applied.

- **Required permission:** `tags:read`
- **Response (JSON)**
  - `documents` — Array of document objects

---

#### Get tags for a document

`GET /api/tags/document`

Returns all tags currently applied to a document.

- **Required permission:** `tags:read`
- **Query parameters**
  - `path` — The document path
- **Response (JSON)**
  - `tags` — Array of tag objects

---

#### Set tags for a document

`POST /api/tags/document`

Replaces all tags on a document with the provided set (full replace, not append).

- **Required permission:** `tags:create` or `tags:update`
- **Body (JSON)**
  - `path` — The document path
  - `tagIds` — Array of tag IDs to apply
- **Response (JSON)**
  - `tags` — The updated list of tags on the document

---

#### Bulk add or remove a tag

`POST /api/tags/bulk`

Adds or removes a single tag across multiple documents at once.

- **Required permission:** `tags:create` or `tags:delete`
- **Body (JSON)**
  - `tagId` — The tag ID to add or remove
  - `documentPaths` — Array of document paths
  - `action` — `"add"` or `"remove"`
- **Response (JSON)**
  - `message` — Success message with count of affected documents

---

#### Get tag-document mappings

`GET /api/tags/mappings`

Returns a map of all document paths to their applied tag IDs. Useful for bulk operations and sidebar filtering.

- **Required permission:** `tags:read`
- **Response (JSON)**
  - `mappings` — Object mapping document paths to arrays of tag IDs
  - `tags` — Array of all tag objects

---

### API Keys

:::note
These endpoints require a regular user login session. They cannot be called using an API key.
:::

#### List API keys

`GET /api/api-keys`

Returns all API keys for the authenticated user.

- **Response (JSON)**
  - `apiKeys` — Array of API key objects (key hash and full key are never returned)

---

#### Create an API key

`POST /api/api-keys`

Creates a new API key. The full key value is returned **only once** in the response — store it securely.

- **Body (JSON)**
  - `name` — A descriptive name for the key
  - `permissions` — Array of permission strings (see [Permissions](#permissions))
  - `expires_at` — (optional) ISO 8601 date string for expiry (e.g. `"2027-01-01"`)
- **Response (JSON)**
  - `apiKey` — The API key object including `key` — the full `plm_...` token (shown once only)

---

#### Revoke an API key

`DELETE /api/api-keys/:id`

Permanently revokes an API key. Any requests using this key will immediately start returning `401`.

- **Response (JSON)**
  - `message` — Success message
