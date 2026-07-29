import { EJSON } from 'bson';
import { AnyBulkWriteOperation, Collection } from 'mongodb';
import { readminCollections } from '~/services/mongo.service';
import { uploadImageBuffer } from '~/services/CDN-service';
import { findCollectionSpec } from '~/services/workspaceExportCollections';

/**
 * Loads a bundle produced by generateWorkspaceExport back into a self-hosted
 * instance. Only ever reachable on a self-hosted deployment (see
 * utils/deployment.ts) — readmin.app is shutting down and has nothing to
 * import into.
 *
 * The client does the file reading and drives this in batches, one collection
 * chunk per call, so neither side has to hold a whole export in memory and an
 * interrupted import can simply be re-run from where it stopped.
 *
 * Writes are upserts keyed on `_id`: a document that is not there is inserted,
 * one that is gets overwritten. Nothing is ever deleted, so importing into a
 * workspace that already has data merges rather than destroys, and re-running
 * the same batch is a no-op rather than a duplicate.
 */

/** Documents accepted per call. Keeps request bodies and bulkWrite batches sane. */
export const IMPORT_BATCH_LIMIT = 1000;

/** Largest single CDN file accepted through the re-upload endpoint (25 MB). */
export const IMPORT_MAX_FILE_BYTES = 25 * 1024 * 1024;

export type ImportBatchResult = {
  collection: string;
  received: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

/**
 * Import one batch of NDJSON lines into a collection.
 *
 * `groupId` is the workspace the caller is importing into; every document is
 * checked to belong to it before being written. Without that check an import
 * would be an arbitrary write primitive over the whole database — a bundle is
 * just a file, and the person uploading it may not have made it.
 */
export async function importCollectionBatch(params: {
  groupId: string;
  collectionKey: string;
  /** Raw NDJSON lines, each one EJSON for a single document. */
  lines: string[];
}): Promise<ImportBatchResult> {
  const { groupId, collectionKey, lines } = params;

  const spec = findCollectionSpec(collectionKey);
  if (!spec) {
    throw new Error(`Unknown or non-importable collection: ${collectionKey}`);
  }
  if (lines.length > IMPORT_BATCH_LIMIT) {
    throw new Error(`Batch too large: ${lines.length} documents (max ${IMPORT_BATCH_LIMIT})`);
  }

  const collection = readminCollections[spec.key] as unknown as Collection<any>;
  const groupIdNum = parseInt(groupId, 10);

  const operations: AnyBulkWriteOperation<any>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let doc: any;
    try {
      doc = EJSON.parse(trimmed, { relaxed: false });
    } catch {
      errors.push(`Line ${index + 1}: not valid Extended JSON`);
      skipped += 1;
      continue;
    }

    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      errors.push(`Line ${index + 1}: not a document`);
      skipped += 1;
      continue;
    }
    if (!doc._id) {
      // Every exported document has one; without it there is no key to upsert
      // on and a re-run would duplicate the row.
      errors.push(`Line ${index + 1}: missing _id`);
      skipped += 1;
      continue;
    }
    if (!documentBelongsToWorkspace(doc, spec.key, groupId, groupIdNum)) {
      errors.push(`Line ${index + 1}: belongs to a different workspace`);
      skipped += 1;
      continue;
    }

    const { _id, ...rest } = doc;
    operations.push({
      replaceOne: { filter: { _id }, replacement: { _id, ...rest }, upsert: true },
    });
  }

  if (!operations.length) {
    return { collection: spec.key, received: lines.length, inserted: 0, updated: 0, skipped, errors };
  }

  // Unordered so one bad document cannot abandon the rest of the batch.
  const result = await collection.bulkWrite(operations, { ordered: false });

  return {
    collection: spec.key,
    received: lines.length,
    inserted: (result.upsertedCount ?? 0) + (result.insertedCount ?? 0),
    updated: result.modifiedCount ?? 0,
    skipped,
    errors: errors.slice(0, 20),
  };
}

/**
 * Compare one group identifier against the workspace being imported into,
 * whatever shape it arrived in.
 *
 * Canonical EJSON hands back BSON numeric wrappers — an `Int32`, `Long` or
 * `Double`, never a plain JS `number` — so the numeric `groupId` on the session
 * collections cannot be recognised with `typeof`. Both the numeric value and
 * the string form are checked so a workspace matches whichever way its id was
 * stored.
 */
function sameGroup(value: unknown, groupIdStr: string, groupIdNum: number): boolean {
  if (value === undefined || value === null) return false;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && Number.isFinite(groupIdNum) && numeric === groupIdNum) {
    return true;
  }
  return String(value) === groupIdStr;
}

/**
 * Confirm a document really is part of the workspace being imported into.
 *
 * Mirrors the scoping in workspaceExportCollections.ts: most collections carry
 * a string groupId, the session collections a numeric one, site_alert an
 * array. The live-server chat/log collections carry no group field at all, so
 * there is nothing to verify — they are accepted on the strength of the
 * caller's admin rights over the target workspace.
 */
function documentBelongsToWorkspace(
  doc: any,
  key: string,
  groupIdStr: string,
  groupIdNum: number,
): boolean {
  if (key === 'site_alert') {
    return Array.isArray(doc.groupIds)
      ? doc.groupIds.some((id: unknown) => sameGroup(id, groupIdStr, groupIdNum))
      : false;
  }
  if (key === 'running_game_chats' || key === 'running_game_logs') {
    return true;
  }
  return sameGroup(doc.groupId, groupIdStr, groupIdNum);
}

/**
 * Re-upload one of the workspace's CDN files to this instance's own bucket,
 * under the key it originally had so every stored path still resolves.
 */
export async function importCdnFile(params: {
  groupId: string;
  /** Original object key from cdn-manifest.json. */
  key: string;
  /** File contents, base64 encoded. */
  base64: string;
  contentType?: string;
}): Promise<{ key: string; bytes: number }> {
  const { groupId, key, base64, contentType } = params;

  // The key must sit inside this workspace's prefix — otherwise an import could
  // overwrite another workspace's assets, or anything else in the bucket.
  const prefix = `workspaces/${groupId}/`;
  if (!key.startsWith(prefix) || key.includes('..')) {
    throw new Error(`File key must sit under ${prefix}`);
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength > IMPORT_MAX_FILE_BYTES) {
    throw new Error(
      `File is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB, over the ${
        IMPORT_MAX_FILE_BYTES / 1024 / 1024
      } MB limit`,
    );
  }

  await uploadImageBuffer(key, buffer, contentType || 'application/octet-stream', 'private');
  return { key, bytes: buffer.byteLength };
}

export type ImportManifestSummary = {
  groupId: string;
  groupName?: string;
  generatedAt?: string;
  totalRecords: number;
  collections: { key: string; label: string; records: number; known: boolean }[];
  unknownCollections: string[];
};

/**
 * Validate a bundle's manifest.json before anything is written, so the admin
 * sees what they are about to import — and is told up front if the bundle is
 * for a different workspace.
 */
export function summariseImportManifest(
  manifestJson: string,
  targetGroupId: string,
): ImportManifestSummary {
  let manifest: any;
  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    throw new Error('manifest.json is not valid JSON');
  }

  if (typeof manifest?.format !== 'string' || !manifest.format.startsWith('readmin-workspace-export/')) {
    throw new Error('That does not look like a ReAdmin workspace export (bad manifest format)');
  }
  if (String(manifest.groupId) !== String(targetGroupId)) {
    throw new Error(
      `This bundle is for group ${manifest.groupId}, but you are importing into ${targetGroupId}`,
    );
  }

  const collections: ImportManifestSummary['collections'] = [];
  const unknownCollections: string[] = [];

  for (const entry of manifest.collections ?? []) {
    const spec = findCollectionSpec(entry.key);
    if (!spec) {
      unknownCollections.push(entry.key);
      continue;
    }
    collections.push({
      key: entry.key,
      label: spec.label,
      records: entry.records ?? 0,
      known: true,
    });
  }

  return {
    groupId: String(manifest.groupId),
    groupName: manifest.groupName,
    generatedAt: manifest.generatedAt,
    totalRecords: manifest.totalRecords ?? 0,
    collections,
    unknownCollections,
  };
}
