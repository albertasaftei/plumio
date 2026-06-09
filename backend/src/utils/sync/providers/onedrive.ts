import type {
  SyncProvider,
  RemoteFile,
  OneDriveCredentials,
} from "../provider.js";

interface MSTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface DriveItem {
  id: string;
  name: string;
  folder?: Record<string, unknown>;
  file?: Record<string, unknown>;
  "@microsoft.graph.downloadUrl"?: string;
}

interface DriveItemList {
  value: DriveItem[];
  "@odata.nextLink"?: string;
}

export class OneDriveProvider implements SyncProvider {
  private creds: OneDriveCredentials;

  constructor(creds: OneDriveCredentials) {
    this.creds = { ...creds };
  }

  private async refreshAccessToken(): Promise<void> {
    const tokenUrl = `https://login.microsoftonline.com/${this.creds.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: this.creds.clientId,
      client_secret: this.creds.clientSecret,
      refresh_token: this.creds.refreshToken,
      grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Files.ReadWrite offline_access",
    });

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await res.json()) as MSTokenResponse;
    if (!res.ok || data.error) {
      throw new Error(
        `OneDrive token refresh failed: ${data.error_description ?? data.error ?? "unknown"}`,
      );
    }

    this.creds.accessToken = data.access_token!;
  }

  private authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${this.creds.accessToken}` };
  }

  private driveRoot(): string {
    if (this.creds.folderId) {
      return `https://graph.microsoft.com/v1.0/me/drive/items/${this.creds.folderId}`;
    }
    return "https://graph.microsoft.com/v1.0/me/drive/root";
  }

  private async withRefresh<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("401")) {
        await this.refreshAccessToken();
        return fn();
      }
      throw err;
    }
  }

  async upload(remotePath: string, content: Buffer): Promise<void> {
    await this.withRefresh(async () => {
      // OneDrive supports uploading via path directly
      const encodedPath = encodeURIComponent(remotePath);
      const url = `${this.driveRoot()}:/${encodedPath}:/content`;

      const res = await fetch(url, {
        method: "PUT",
        headers: {
          ...this.authHeader(),
          "Content-Type": "application/octet-stream",
        },
        body: content,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OneDrive upload error ${res.status}: ${text}`);
      }
    });
  }

  async delete(remotePath: string): Promise<void> {
    await this.withRefresh(async () => {
      const encodedPath = encodeURIComponent(remotePath);
      const url = `${this.driveRoot()}:/${encodedPath}`;

      const res = await fetch(url, {
        method: "DELETE",
        headers: this.authHeader(),
      });

      // 404 means file already gone — treat as success
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(`OneDrive delete error ${res.status}: ${text}`);
      }
    });
  }

  async list(prefix: string): Promise<RemoteFile[]> {
    return this.withRefresh(async () => {
      const files: RemoteFile[] = [];

      const listRecursive = async (
        folderId: string,
        pathPrefix: string,
      ): Promise<void> => {
        let url: string | undefined =
          `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$select=id,name,folder,file&$top=200`;

        while (url) {
          const res = await fetch(url, { headers: this.authHeader() });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`OneDrive list error ${res.status}: ${text}`);
          }
          const data = (await res.json()) as DriveItemList;

          for (const item of data.value) {
            const itemPath = pathPrefix
              ? `${pathPrefix}/${item.name}`
              : item.name;
            if (item.folder) {
              await listRecursive(item.id, itemPath);
            } else {
              files.push({
                path: `${prefix}/${itemPath}`.replace(/\/+/g, "/"),
              });
            }
          }

          url = data["@odata.nextLink"];
        }
      };

      // Get the root folder ID
      const rootRes = await fetch(`${this.driveRoot()}?$select=id`, {
        headers: this.authHeader(),
      });
      const root = (await rootRes.json()) as DriveItem;
      await listRecursive(root.id, "");
      return files;
    });
  }

  async testConnection(): Promise<void> {
    await this.withRefresh(async () => {
      const res = await fetch(
        "https://graph.microsoft.com/v1.0/me/drive?$select=id",
        { headers: this.authHeader() },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OneDrive connection test failed: ${text}`);
      }
    });
  }

  getCredentials(): OneDriveCredentials {
    return this.creds;
  }
}
