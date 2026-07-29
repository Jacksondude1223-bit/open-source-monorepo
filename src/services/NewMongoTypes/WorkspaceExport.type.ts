import { ObjectId } from 'mongodb';

/**
 * A full workspace takeout job — every document ReAdmin holds for one
 * workspace, plus a manifest of its CDN objects, written out to the CDN as a
 * set of downloadable files.
 *
 * Built for the ReAdmin shutdown: a workspace admin starts one of these, it
 * runs in the background (collection by collection, streamed, never loading a
 * whole collection into memory), and the resulting files can be re-imported
 * into a self-hosted instance. See generateWorkspaceExport.ts.
 */
export type WorkspaceExportStatus = 'pending' | 'running' | 'finished' | 'failed';

/** One file written to the CDN as part of the bundle. */
export type WorkspaceExportFile = {
  /** Path inside the bundle as the user sees it, e.g. `data/group_member.part-0001.ndjson`. */
  name: string;
  /** The CDN object key it actually lives at. */
  key: string;
  bytes: number;
  /** Number of NDJSON records, for data files. */
  records?: number;
};

export type WorkspaceExport = {
  _id?: ObjectId;
  processId: string;
  groupId: string;
  status: WorkspaceExportStatus;
  requestedByRobloxId: string;
  requestedByName?: string;

  /** Human-readable progress, e.g. "Exporting group_member". */
  stage?: string;
  collectionsDone: number;
  collectionsTotal: number;
  /**
   * Collections already written out in full. A run that is killed part way —
   * a serverless timeout, a deploy, a restart — is resumed by skipping these,
   * so an export never has to start over. An interrupted collection is absent
   * from this list and simply re-runs, overwriting its own parts.
   */
  completedCollections: string[];

  /** Record count per collection. Collections with zero rows are omitted. */
  counts: Record<string, number>;
  totalRecords: number;

  files: WorkspaceExportFile[];

  /** CDN objects found under this workspace's prefix. */
  cdnObjectCount: number;
  cdnTotalBytes: number;

  error?: string;
  created: Date;
  updated?: Date;
  completed?: Date;
  /**
   * When the presigned URLs inside cdn-manifest.json stop working (7 days, the
   * maximum S3 allows). The bundle itself is re-generatable after that.
   */
  urlsExpireAt?: Date;
};
