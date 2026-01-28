-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Organization members (many-to-many with roles)
CREATE TABLE IF NOT EXISTS organization_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'member'
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_id)
);

-- Sessions table (includes current organization context)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    current_organization_id INTEGER,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (current_organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Documents table (organization-scoped)
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    title TEXT NOT NULL,
    color TEXT,
    size INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    archived_at DATETIME,
    archived_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, path),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (archived_by) REFERENCES users(id)
);

-- Full-text search virtual table (standalone, not content-backed)
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    path,
    title,
    content
);

-- Triggers to keep FTS index in sync with documents table
CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid, path, title, content)
    VALUES (new.id, new.path, new.title, '');
END;

CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
    DELETE FROM documents_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE OF path, title ON documents BEGIN
    UPDATE documents_fts SET path = new.path, title = new.title
    WHERE rowid = new.id;
END;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_archived ON documents(organization_id, archived);
