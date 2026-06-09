import type {
  SyncProvider,
  RemoteFile,
  DropboxCredentials,
} from "../provider.js";

interface DropboxListEntry {
  ".tag": string;
  path_lower?: string;
  path_display?: string;
}

interface DropboxListResponse {
  entries: DropboxListEntry[];
  cursor: string;
  has_more: boolean;
}

interface DropboxTokenResponse {
  access_token: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export class DropboxProvider implements SyncProvider {
  private creds: DropboxCredentials;

  constructor(creds: DropboxCredentials) {
    this.creds = { ...creds };
  }

  private async refreshAccessToken(): Promise<void> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.creds.refreshToken,
      client_id: this.creds.appKey,
      client_secret: this.creds.appSecret,
    });

    const res = await fetch("https://api.dropbox.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = (await res.json()) as DropboxTokenResponse;
    if (!res.ok || data.error) {
      throw new Error(
        `Dropbox token refresh failed: ${data.error_description ?? data.error ?? "unknown"}`,
      );
    }

    this.creds.accessToken = data.access_token;
  }

  private async apiCall<T>(
    url: string,
    body: unknown,
    retried = false,
  ): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401 && !retried) {
      await this.refreshAccessToken();
      return this.apiCall<T>(url, body, true);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Dropbox API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async upload(remotePath: string, content: Buffer): Promise<void> {
    const dropboxPath = remotePath.startsWith("/")
      ? remotePath
      : `/${remotePath}`;

    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: "overwrite",
          autorename: false,
          mute: true,
        }),
      },
      body: content,
    });

    if (res.status === 401) {
      await this.refreshAccessToken();
      return this.upload(remotePath, content);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Dropbox upload error ${res.status}: ${text}`);
    }
  }

  async delete(remotePath: string): Promise<void> {
    const dropboxPath = remotePath.startsWith("/")
      ? remotePath
      : `/${remotePath}`;
    await this.apiCall("https://api.dropboxapi.com/2/files/delete_v2", {
      path: dropboxPath,
    });
  }

  async list(prefix: string): Promise<RemoteFile[]> {
    const dropboxPath = prefix.startsWith("/") ? prefix : `/${prefix}`;
    const files: RemoteFile[] = [];

    interface ListFolderResponse extends DropboxListResponse {}

    let data = await this.apiCall<ListFolderResponse>(
      "https://api.dropboxapi.com/2/files/list_folder",
      { path: dropboxPath, recursive: true },
    );

    for (const entry of data.entries) {
      if (entry[".tag"] === "file" && entry.path_display) {
        files.push({ path: entry.path_display });
      }
    }

    while (data.has_more) {
      data = await this.apiCall<ListFolderResponse>(
        "https://api.dropboxapi.com/2/files/list_folder/continue",
        { cursor: data.cursor },
      );
      for (const entry of data.entries) {
        if (entry[".tag"] === "file" && entry.path_display) {
          files.push({ path: entry.path_display });
        }
      }
    }

    return files;
  }

  async testConnection(): Promise<void> {
    await this.apiCall(
      "https://api.dropboxapi.com/2/users/get_current_account",
      null,
    );
  }

  /** Returns updated credentials (new access token after refresh). Call after upload/delete/list to persist the refreshed token. */
  getCredentials(): DropboxCredentials {
    return this.creds;
  }
}
