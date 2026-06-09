export interface RemoteFile {
  path: string;
}

export interface SyncProvider {
  /** Upload (create or overwrite) a file at the given remote path. */
  upload(remotePath: string, content: Buffer): Promise<void>;
  /** Delete a file at the given remote path. */
  delete(remotePath: string): Promise<void>;
  /** List all files under the given prefix. */
  list(prefix: string): Promise<RemoteFile[]>;
  /** Verify that the credentials and target location are reachable. */
  testConnection(): Promise<void>;
}

export type SyncProviderType =
  | "s3"
  | "s3-compatible"
  | "dropbox"
  | "gdrive"
  | "onedrive";

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  endpoint?: string; // for S3-compatible providers
}

export interface DropboxCredentials {
  appKey: string;
  appSecret: string;
  accessToken: string;
  refreshToken: string;
}

export interface GDriveCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  folderId?: string;
}

export interface OneDriveCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  folderId?: string;
}

export type ProviderCredentials =
  | S3Credentials
  | DropboxCredentials
  | GDriveCredentials
  | OneDriveCredentials;
