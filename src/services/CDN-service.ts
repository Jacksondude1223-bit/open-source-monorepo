import { getMimeByExt } from '../utils/File';
import { readminCollections } from './mongo.service';
import { storage } from './storage';
import type { StorageAcl } from './storage';

/**
 * Note for anyone comparing against the pre-storage-driver version: that one
 * also set `ContentEncoding: 'base64'` on the S3 put, while handing S3 an
 * already-decoded Buffer. The header was simply wrong — the body is raw bytes —
 * and it is not set any more. Objects uploaded before the change still carry it.
 */
export async function uploadImageBuffer(filePath: string, buffer: Buffer, ContentType?: string, permission?: StorageAcl) {
  await storage.put(
    filePath,
    buffer,
    ContentType || 'image/png',
    permission || 'private',
  );
}

export async function uploadImage(filePath: string, fileName: string, fileData: string, permission?: StorageAcl) {
  const buffer = Buffer.from((fileData.split(',') as any)[1], 'base64');
  const ContentType = getMimeByExt(fileName.substring(fileName.length - 3));
  await uploadImageBuffer(filePath, buffer, ContentType, permission);
}

/** A stable URL for an object uploaded with `public-read`. */
export function publicUrl(filePath: string): string {
  return storage.publicUrl(filePath);
}

export async function presignUrl(filePath: string, expiresInSeconds: number) {
  const cached = await readminCollections.image_cache.findOne({
    filePath,
    expires: { $gt: new Date() }
  })

  if (cached) {
    return cached.signedUrl;
  }

  const url = await storage.signedUrl(filePath, expiresInSeconds);

  await readminCollections.image_cache.insertOne({
    filePath,
    signedUrl: url,
    from: new Date(),
    expires: new Date(Date.now() + expiresInSeconds * 1000),
    created: new Date()
  })

  return url;
}

export async function presignArrayOfPaths(paths: string[], expiresInSeconds: number): Promise<string[]> {
  if (!paths || paths.length == 0) {
    return [];
  }
  const urls = await Promise.all(paths.map((path) => presignUrl(path, expiresInSeconds)));
  return urls;
}
