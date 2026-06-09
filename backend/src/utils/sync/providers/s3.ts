import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { SyncProvider, RemoteFile, S3Credentials } from "../provider.js";

export class S3Provider implements SyncProvider {
  private client: S3Client;
  private bucket: string;

  constructor(creds: S3Credentials) {
    this.bucket = creds.bucket;
    this.client = new S3Client({
      region: creds.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
      ...(creds.endpoint
        ? { endpoint: creds.endpoint, forcePathStyle: true }
        : {}),
    });
  }

  async upload(remotePath: string, content: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: remotePath,
        Body: content,
      }),
    );
  }

  async delete(remotePath: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: remotePath,
      }),
    );
  }

  async list(prefix: string): Promise<RemoteFile[]> {
    const files: RemoteFile[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of response.Contents ?? []) {
        if (obj.Key) {
          files.push({ path: obj.Key });
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return files;
  }

  async testConnection(): Promise<void> {
    // List with a limit of 1 to verify credentials + bucket access
    await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      }),
    );
  }
}
