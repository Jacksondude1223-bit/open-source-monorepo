/** An object's visibility. Mirrors the two S3 ACLs this codebase ever sets. */
export type StorageAcl = 'private' | 'public-read';

export type StorageObject = {
  key: string;
  bytes: number;
  lastModified?: Date;
};

/**
 * The storage operations ReAdmin actually performs, independent of where the
 * bytes live. Two drivers implement it: S3-compatible object storage, and the
 * VPS's own disk (see `local.driver.ts`).
 *
 * Keys are S3-style slash-separated paths — `workspaces/123/logo.png`. They are
 * never absolute and never contain `..`; the local driver enforces that, since
 * on disk a stray `..` would escape the storage root.
 */
export interface StorageDriver {
  /** Human-readable driver name, for logs and errors. */
  readonly name: 's3' | 'local';

  put(
    key: string,
    body: Buffer | string,
    contentType: string,
    acl: StorageAcl,
  ): Promise<void>;

  /**
   * A time-limited URL the browser can fetch directly. Private objects are only
   * ever exposed this way.
   */
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;

  /** Every object under `prefix`. Used to build workspace export manifests. */
  list(prefix: string): Promise<StorageObject[]>;

  /**
   * A stable, non-expiring URL for an object stored with `public-read`. Throws
   * for objects that were not uploaded public — there is no such URL for them.
   */
  publicUrl(key: string): string;
}
