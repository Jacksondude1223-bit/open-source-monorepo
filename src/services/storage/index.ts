import { env } from '~/services/env';
import { localDriver } from './local.driver';
import { s3Driver } from './s3.driver';
import type { StorageDriver } from './types';

export type { StorageAcl, StorageDriver, StorageObject } from './types';

/**
 * Where uploaded files live.
 *
 * `local` keeps them on the VPS's own disk and serves them from the API — no
 * bucket, no keys, nothing to pay for. `s3` (the default) talks to any
 * S3-compatible object store.
 *
 * Chosen once at startup: switching drivers does not migrate anything, so a
 * deployment that has been running on one and moves to the other must copy its
 * objects across itself.
 */
export const storage: StorageDriver =
  env.STORAGE_DRIVER === 'local' ? localDriver : s3Driver;

export const usingLocalStorage = storage.name === 'local';
