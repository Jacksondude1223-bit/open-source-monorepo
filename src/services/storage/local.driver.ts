import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { env } from '~/services/env';
import type { StorageAcl, StorageDriver, StorageObject } from './types';

/**
 * Stores objects on the VPS's own disk instead of an S3 bucket.
 *
 * Layout under STORAGE_LOCAL_PATH:
 *
 *   objects/<key>        the bytes, at the key's own path
 *   meta/<key>.json      { contentType, acl }
 *
 * Metadata lives in a parallel tree rather than beside the file so that listing
 * `objects/` returns exactly the real objects — no sidecars to filter out.
 *
 * Serving is the API's job: this driver only mints URLs, and
 * `fastifyAPI/routers/files.ts` answers them. Private objects get an HMAC-signed
 * URL that expires; public ones get a stable path.
 */

/** The API origin that serves `/files`. Both processes read it from .env. */
function apiBaseUrl(): string {
  const base = env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error(
      'STORAGE_DRIVER=local needs NEXT_PUBLIC_API_URL set to the public URL of ' +
        'the API — it is where uploaded files are served from.',
    );
  }
  return base.replace(/\/+$/, '');
}

export function storageRoot(): string {
  return env.STORAGE_LOCAL_PATH || '/var/lib/readmin/storage';
}

/**
 * Normalise a key and refuse anything that would land outside the storage root.
 * Keys reach here from upload handlers that build them from user-supplied file
 * names, so this is the boundary that keeps `../../etc/passwd` off the disk.
 *
 * A leading slash is stripped rather than rejected — `/workspaces/1/x.png` and
 * `workspaces/1/x.png` name the same object, which is how S3 reads them too, and
 * legacy rows hold both forms. Stripping cannot escape the root: `/../../etc` is
 * still caught by the `..` check below, on the stripped value.
 */
export function assertSafeKey(key: string): string {
  const trimmed = (key || '').replace(/^\/+/, '');
  if (!trimmed) {
    throw new Error('Storage key is empty.');
  }
  if (path.isAbsolute(trimmed) || trimmed.split('/').some((part) => part === '..')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  // Normalise then re-check: normalisation is what collapses `a/./b` and any
  // backslash trickery into the form we compare against.
  const normalised = path.posix.normalize(trimmed);
  if (normalised.startsWith('..') || path.isAbsolute(normalised)) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return normalised;
}

function objectPath(key: string): string {
  return path.join(storageRoot(), 'objects', assertSafeKey(key));
}

function metaPath(key: string): string {
  return path.join(storageRoot(), 'meta', `${assertSafeKey(key)}.json`);
}

export type LocalObjectMeta = { contentType: string; acl: StorageAcl };

export async function readObjectMeta(key: string): Promise<LocalObjectMeta | null> {
  try {
    return JSON.parse(await fs.readFile(metaPath(key), 'utf8')) as LocalObjectMeta;
  } catch {
    return null;
  }
}

/** Absolute path of an object's bytes, or null when it does not exist. */
export async function resolveObjectFile(key: string): Promise<string | null> {
  const file = objectPath(key);
  try {
    const stat = await fs.stat(file);
    return stat.isFile() ? file : null;
  } catch {
    return null;
  }
}

/**
 * The secret behind signed URLs. Reuses the session signing secret rather than
 * adding another key to the environment — both are "this deployment can vouch
 * for this string", and rotating one should invalidate the other anyway.
 */
function signingSecret(): string {
  return env.JSON_WEB_TOKEN_SECRET;
}

export function signKey(key: string, expiresAtMs: number): string {
  return createHmac('sha256', signingSecret())
    .update(`${assertSafeKey(key)}:${expiresAtMs}`)
    .digest('hex');
}

/**
 * Whether a signature matches and has not expired. Compared in constant time so
 * the endpoint cannot be used as an oracle to forge one byte at a time.
 */
export function verifySignature(key: string, expiresAtMs: number, signature: string): boolean {
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    return false;
  }
  let expected: string;
  try {
    expected = signKey(key, expiresAtMs);
  } catch {
    return false;
  }
  const given = Buffer.from(String(signature || ''), 'utf8');
  const want = Buffer.from(expected, 'utf8');
  return given.length === want.length && timingSafeEqual(given, want);
}

/** Percent-encode each path segment, leaving the slashes as separators. */
function encodeKeyPath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

async function walk(dir: string, root: string, out: StorageObject[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // A prefix with nothing under it lists empty, like S3.
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, root, out);
    } else if (entry.isFile()) {
      const stat = await fs.stat(full);
      out.push({
        key: path.relative(root, full).split(path.sep).join('/'),
        bytes: stat.size,
        lastModified: stat.mtime,
      });
    }
  }
}

export const localDriver: StorageDriver = {
  name: 'local',

  async put(key, body, contentType, acl) {
    const file = objectPath(key);
    const meta = metaPath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.mkdir(path.dirname(meta), { recursive: true });
    await fs.writeFile(file, typeof body === 'string' ? Buffer.from(body) : body);
    await fs.writeFile(meta, JSON.stringify({ contentType, acl } satisfies LocalObjectMeta));
  },

  async signedUrl(key, expiresInSeconds) {
    const safe = assertSafeKey(key);
    const expires = Date.now() + expiresInSeconds * 1000;
    const signature = signKey(safe, expires);
    return `${apiBaseUrl()}/files/signed/${encodeKeyPath(safe)}?expires=${expires}&signature=${signature}`;
  },

  async list(prefix) {
    const root = path.join(storageRoot(), 'objects');
    const safePrefix = (prefix || '').replace(/^\/+/, '');
    let startDir = path.join(root, assertSafeKey(safePrefix || '.'));
    // S3 prefixes are string prefixes, not directories — "workspaces/1/logo"
    // matches "logo-2.png". When the prefix is not itself a directory, walk its
    // parent and let the filter below do the matching.
    const isDirectory = await fs
      .stat(startDir)
      .then((stat) => stat.isDirectory())
      .catch(() => false);
    if (!isDirectory) {
      startDir = path.dirname(startDir);
    }
    const found: StorageObject[] = [];
    await walk(startDir, root, found);
    return found.filter((object) => object.key.startsWith(safePrefix));
  },

  publicUrl(key) {
    return `${apiBaseUrl()}/files/public/${encodeKeyPath(assertSafeKey(key))}`;
  },
};
