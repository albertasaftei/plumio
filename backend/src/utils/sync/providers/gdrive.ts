import type {
  SyncProvider,
  RemoteFile,
  GDriveCredentials,
} from "../provider.js";

interface GDriveFile {
  id: string;
  name: string;
  parents?: string[];
}

interface GDriveTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export class GDriveProvider implements SyncProvider {
  private creds: GDriveCredentials;

  constructor(creds: GDriveCredentials) {
    this.creds = { ...creds };
  }

  private async refreshAccessToken(): Promise<void> {
    const params = new URLSearchParams({
      client_id: this.creds.clientId,
      client_secret: this.creds.clientSecret,
      refresh_token: this.creds.refreshToken,
      grant_type: "refresh_token",
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await res.json()) as GDriveTokenResponse;
    if (!res.ok || data.error) {
      throw new Error(
        `Google token refresh failed: ${data.error_description ?? data.error ?? "unknown"}`,
      );
    }

    this.creds.accessToken = data.access_token!;
  }

  private authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${this.creds.accessToken}` };
  }

  /** Ensure the folder path exists under the configured root, returning the leaf folder ID. */
  private async ensureFolderPath(parts: string[]): Promise<string> {
    let parentId = this.creds.folderId ?? "root";

    for (const part of parts) {
      const query = encodeURIComponent(
        `mimeType='application/vnd.google-apps.folder' and name='${part}' and '${parentId}' in parents and trashed=false`,
      );
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
        { headers: this.authHeader() },
      );
      const data = (await res.json()) as { files: GDriveFile[] };

      if (data.files.length > 0) {
        parentId = data.files[0].id;
      } else {
        // Create folder
        const createRes = await fetch(
          "https://www.googleapis.com/drive/v3/files",
          {
            method: "POST",
            headers: {
              ...this.authHeader(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: part,
              mimeType: "application/vnd.google-apps.folder",
              parents: [parentId],
            }),
          },
        );
        const created = (await createRes.json()) as GDriveFile;
        parentId = created.id;
      }
    }

    return parentId;
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
      const parts = remotePath.split("/").filter(Boolean);
      const fileName = parts.pop()!;
      const folderId =
        parts.length > 0
          ? await this.ensureFolderPath(parts)
          : (this.creds.folderId ?? "root");

      // Check if file already exists
      const query = encodeURIComponent(
        `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      );
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
        { headers: this.authHeader() },
      );
      const searchData = (await searchRes.json()) as { files: GDriveFile[] };

      if (searchData.files.length > 0) {
        // Update existing file
        const fileId = searchData.files[0].id;
        const res = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              ...this.authHeader(),
              "Content-Type": "application/octet-stream",
            },
            body: content,
          },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`GDrive update error ${res.status}: ${text}`);
        }
      } else {
        // Create new file using multipart upload
        const metadata = JSON.stringify({
          name: fileName,
          parents: [folderId],
        });
        const boundary = "plumio_boundary";
        const body =
          [
            `--${boundary}`,
            "Content-Type: application/json; charset=UTF-8",
            "",
            metadata,
            `--${boundary}`,
            "Content-Type: application/octet-stream",
            "",
          ].join("\r\n") +
          "\r\n" +
          content.toString("binary") +
          `\r\n--${boundary}--`;

        const res = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: {
              ...this.authHeader(),
              "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body: Buffer.from(body, "binary"),
          },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`GDrive upload error ${res.status}: ${text}`);
        }
      }
    });
  }

  async delete(remotePath: string): Promise<void> {
    await this.withRefresh(async () => {
      const parts = remotePath.split("/").filter(Boolean);
      const fileName = parts.pop()!;
      const folderId =
        parts.length > 0
          ? await this.ensureFolderPath(parts)
          : (this.creds.folderId ?? "root");

      const query = encodeURIComponent(
        `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      );
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`,
        { headers: this.authHeader() },
      );
      const searchData = (await searchRes.json()) as { files: GDriveFile[] };

      if (searchData.files.length > 0) {
        const fileId = searchData.files[0].id;
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: "DELETE",
          headers: this.authHeader(),
        });
      }
    });
  }

  async list(prefix: string): Promise<RemoteFile[]> {
    return this.withRefresh(async () => {
      const rootId = this.creds.folderId ?? "root";
      const files: RemoteFile[] = [];

      const listRecursive = async (
        folderId: string,
        pathPrefix: string,
      ): Promise<void> => {
        let pageToken: string | undefined;
        do {
          const query = encodeURIComponent(
            `'${folderId}' in parents and trashed=false`,
          );
          const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=nextPageToken,files(id,name,mimeType)${pageToken ? `&pageToken=${pageToken}` : ""}`;
          const res = await fetch(url, { headers: this.authHeader() });
          const data = (await res.json()) as {
            files: Array<GDriveFile & { mimeType: string }>;
            nextPageToken?: string;
          };

          for (const f of data.files) {
            const filePath = pathPrefix ? `${pathPrefix}/${f.name}` : f.name;
            if (f.mimeType === "application/vnd.google-apps.folder") {
              await listRecursive(f.id, filePath);
            } else {
              files.push({
                path: `${prefix}/${filePath}`.replace(/\/+/g, "/"),
              });
            }
          }

          pageToken = data.nextPageToken;
        } while (pageToken);
      };

      await listRecursive(rootId, "");
      return files;
    });
  }

  async testConnection(): Promise<void> {
    await this.withRefresh(async () => {
      const res = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user",
        { headers: this.authHeader() },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GDrive connection test failed: ${text}`);
      }
    });
  }

  getCredentials(): GDriveCredentials {
    return this.creds;
  }
}
