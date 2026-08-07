import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '~/services/env';
import type { StorageDriver, StorageObject } from './types';

/** One page of a bucket listing. Big workspaces run to thousands of objects. */
const LIST_PAGE_SIZE = 1000;

let client: S3 | undefined;

/**
 * Built on first use, not at import time: a deployment running
 * STORAGE_DRIVER=local has no bucket credentials at all, and importing this
 * module must not demand them.
 */
function s3(): S3 {
  if (!client) {
    const missing = (
      [
        ['CDN_ENDPOINT', env.CDN_ENDPOINT],
        ['CDN_REIGON', env.CDN_REIGON],
        ['CDN_ACCESS_KEY_ID', env.CDN_ACCESS_KEY_ID],
        ['CDN_SECRET_ACCESS_KEY', env.CDN_SECRET_ACCESS_KEY],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length) {
      throw new Error(
        `STORAGE_DRIVER=s3 needs ${missing.join(', ')}. Set them, or switch to ` +
          'STORAGE_DRIVER=local to keep uploads on this server’s disk.',
      );
    }
    client = new S3({
      forcePathStyle: false,
      endpoint: env.CDN_ENDPOINT,
      region: env.CDN_REIGON,
      credentials: {
        accessKeyId: env.CDN_ACCESS_KEY_ID as string,
        secretAccessKey: env.CDN_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return client;
}

export function bucketName(): string {
  return env.CDN_BUCKET_NAME || 'cdn.readmin.app';
}

/** S3-compatible object storage: DigitalOcean Spaces, R2, MinIO, S3 itself. */
export const s3Driver: StorageDriver = {
  name: 's3',

  async put(key, body, contentType, acl) {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucketName(),
        Key: key,
        Body: body,
        ACL: acl,
        ContentType: contentType,
      }),
    );
  },

  async signedUrl(key, expiresInSeconds) {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: bucketName(), Key: key }),
      { expiresIn: expiresInSeconds },
    );
  },

  async list(prefix) {
    const objects: StorageObject[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await s3().send(
        new ListObjectsV2Command({
          Bucket: bucketName(),
          Prefix: prefix,
          MaxKeys: LIST_PAGE_SIZE,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of page.Contents ?? []) {
        if (!object.Key) continue;
        objects.push({
          key: object.Key,
          bytes: object.Size ?? 0,
          lastModified: object.LastModified,
        });
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return objects;
  },

  publicUrl(key) {
    return `${(env.CDN_URL || '').replace(/\/+$/, '')}/${key}`;
  },
};
