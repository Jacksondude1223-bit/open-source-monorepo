import { GetObjectCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { env } from '~/services/env';
import { getMimeByExt } from '../utils/File';
import {
  getSignedUrl
} from "@aws-sdk/s3-request-presigner";
import { readminCollections } from './mongo.service';

export const s3Client = new S3({
  forcePathStyle: false,
  endpoint: env.CDN_ENDPOINT,
  region: env.CDN_REIGON,
  credentials: {
    accessKeyId: env.CDN_ACCESS_KEY_ID,
    secretAccessKey: env.CDN_SECRET_ACCESS_KEY,
  },
});

export async function uploadImageBuffer(filePath: string, buffer: Buffer, ContentType?: string, permission?: 'private' | 'public-read') {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.CDN_BUCKET_NAME || 'cdn.readmin.app',
      Key: filePath,
      Body: buffer,
      ACL: permission || 'private',
      ContentType: ContentType || 'image/png',
      ContentEncoding: 'base64',
    }),
  );
}

export async function uploadImage(filePath: string, fileName: string, fileData: string, permission?: 'private' | 'public-read') {
  const buffer = Buffer.from((fileData.split(',') as any)[1], 'base64');
  const ContentType = getMimeByExt(fileName.substring(fileName.length - 3));
  await uploadImageBuffer(filePath, buffer, ContentType, permission);
}

export async function presignUrl(filePath: string, expiresInSeconds: number) {
  const command = new GetObjectCommand({
    Bucket: env.CDN_BUCKET_NAME || 'cdn.readmin.app',
    Key: filePath,
  });

  const cached = await readminCollections.image_cache.findOne({
    filePath,
    expires: { $gt: new Date() }
  })

  if (cached) {
    return cached.signedUrl;
  }

  const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

  await readminCollections.image_cache.insertOne({
    filePath,
    signedUrl: url,
    from: new Date(),
    expires: new Date(Date.now() + expiresInSeconds * 1000),
    created: new Date()
  })

  // console.log(url, `${env.CDN_URL}${url.split('app')[1]}`)
  return url//`${env.CDN_URL}${url.split('app')[1]}`;
}

export async function presignArrayOfPaths(paths: string[], expiresInSeconds: number): Promise<string[]> {
  if (!paths || paths.length == 0) {
    return [];
  }
  const urls = await Promise.all(paths.map((path) => presignUrl(path, expiresInSeconds)));
  return urls;
}