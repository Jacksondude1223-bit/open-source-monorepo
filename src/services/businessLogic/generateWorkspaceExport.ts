import { EJSON } from 'bson';
import { Collection } from 'mongodb';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '~/services/CDN-service';
import { env } from '~/services/env';
import { readminCollections, MongoTypes } from '~/services/mongo.service';
import {
  WORKSPACE_COLLECTIONS,
  resolveWorkspaceScope,
  WorkspaceScope,
} from '~/services/workspaceExportCollections';

/**
 * Builds a complete takeout of one workspace: every document from every
 * workspace-scoped collection, plus a manifest of every CDN object the
 * workspace owns, written to the CDN as a set of private files.
 *
 * Written for the ReAdmin shutdown, so the priority is finishing without
 * hurting the live site. The measures that matter:
 *
 *  - Collections are walked one at a time, never in parallel. Sixty concurrent
 *    collection scans would be the thing that takes the database down.
 *  - Each collection is streamed through a cursor and serialised into a bounded
 *    buffer that is flushed to the CDN as a numbered part once it passes
 *    PART_SIZE_BYTES. Peak memory is one part, not one collection, so a
 *    workspace with millions of session events costs the same as a small one.
 *  - Reads go to a secondary where the deployment has one, keeping a long scan
 *    off the primary that is serving the site.
 *  - CDN objects are enumerated straight from the bucket (every workspace asset
 *    is written under `workspaces/<groupId>/`), so nothing has to scan the
 *    database looking for file paths.
 *  - Presigning is done with getSignedUrl directly rather than the shared
 *    presignUrl helper, because that helper writes an image_cache row per call
 *    — thousands of pointless inserts for a bucket listing.
 *
 * Documents are serialised as Extended JSON (EJSON) so ObjectIds and Dates
 * survive the round trip into a self-hosted instance intact. Plain JSON.stringify
 * would flatten them to strings and quietly corrupt every relation on import.
 */

const BUCKET = env.CDN_BUCKET_NAME || 'cdn.readmin.app';

/** Flush a part once the buffered NDJSON passes this. Bounds peak memory. */
const PART_SIZE_BYTES = 8 * 1024 * 1024;

/** Documents pulled per cursor batch. */
const CURSOR_BATCH_SIZE = 500;

/** Max lifetime S3 allows on a presigned URL. */
const PRESIGN_SECONDS = 7 * 24 * 60 * 60;

/** How many presign operations to run at once. */
const PRESIGN_CONCURRENCY = 50;

/** Objects per ListObjectsV2 page (the S3 maximum). */
const LIST_PAGE_SIZE = 1000;

/** Bundle layout inside the CDN. */
const exportPrefix = (groupId: string, processId: string) =>
  `workspaces/${groupId}/exports/${processId}`;

/**
 * The workspace's own CDN assets all live under this prefix. Note that
 * generated bundles live under `<prefix>/exports/`, which is skipped when
 * listing so an export never includes previous exports of itself.
 */
const workspaceAssetPrefix = (groupId: string) => `workspaces/${groupId}/`;
const exportsSubPrefix = (groupId: string) => `workspaces/${groupId}/exports/`;

type CdnObject = { key: string; bytes: number; lastModified?: Date; url: string };

async function putBundleFile(
  groupId: string,
  processId: string,
  name: string,
  body: string | Buffer,
  contentType: string,
): Promise<MongoTypes.WorkspaceExportFile> {
  const key = `${exportPrefix(groupId, processId)}/${name}`;
  const bytes = Buffer.byteLength(body as any);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      // Private, always. This is the workspace's staff records, application
      // responses and API keys — it must never be world-readable on the CDN.
      ACL: 'private',
      ContentType: contentType,
    }),
  );
  return { name, key, bytes };
}

async function patchJob(processId: string, set: Partial<MongoTypes.WorkspaceExport>) {
  await readminCollections.workspace_export.updateOne(
    { processId },
    { $set: { ...set, updated: new Date() } },
  );
}

/**
 * Stream one collection out to numbered NDJSON parts.
 * Returns the files written and the record count.
 */
async function exportCollection(
  spec: (typeof WORKSPACE_COLLECTIONS)[number],
  scope: WorkspaceScope,
  processId: string,
): Promise<{ files: MongoTypes.WorkspaceExportFile[]; records: number }> {
  const collection = readminCollections[spec.key] as unknown as Collection<any>;
  const filter = spec.filter(scope);

  const cursor = collection.find(filter, {
    batchSize: CURSOR_BATCH_SIZE,
    // Keep the scan off the primary when a secondary is available.
    readPreference: 'secondaryPreferred',
  });

  const files: MongoTypes.WorkspaceExportFile[] = [];
  let buffer: string[] = [];
  let bufferBytes = 0;
  let bufferRecords = 0;
  let records = 0;
  let part = 0;

  const flush = async () => {
    if (!bufferRecords) return;
    part += 1;
    const name = `data/${spec.key}.part-${String(part).padStart(4, '0')}.ndjson`;
    const file = await putBundleFile(
      scope.groupIdStr,
      processId,
      name,
      buffer.join(''),
      'application/x-ndjson',
    );
    files.push({ ...file, records: bufferRecords });
    buffer = [];
    bufferBytes = 0;
    bufferRecords = 0;
  };

  try {
    for await (const doc of cursor) {
      const line = EJSON.stringify(doc, { relaxed: false }) + '\n';
      buffer.push(line);
      bufferBytes += Buffer.byteLength(line);
      bufferRecords += 1;
      records += 1;
      if (bufferBytes >= PART_SIZE_BYTES) await flush();
    }
    await flush();
  } finally {
    await cursor.close().catch(() => {});
  }

  return { files, records };
}

/** Enumerate every CDN object the workspace owns, with a presigned URL each. */
async function listWorkspaceCdnObjects(groupId: string): Promise<CdnObject[]> {
  const assetPrefix = workspaceAssetPrefix(groupId);
  const skipPrefix = exportsSubPrefix(groupId);

  const raw: { key: string; bytes: number; lastModified?: Date }[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: assetPrefix,
        MaxKeys: LIST_PAGE_SIZE,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (!object.Key) continue;
      // Never fold generated bundles back into the manifest.
      if (object.Key.startsWith(skipPrefix)) continue;
      raw.push({ key: object.Key, bytes: object.Size ?? 0, lastModified: object.LastModified });
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  // Presigning is local crypto, but a big workspace has thousands of objects —
  // chunk it so we do not open thousands of promises at once.
  const objects: CdnObject[] = [];
  for (let i = 0; i < raw.length; i += PRESIGN_CONCURRENCY) {
    const chunk = raw.slice(i, i + PRESIGN_CONCURRENCY);
    const signed = await Promise.all(
      chunk.map(async (object) => ({
        ...object,
        url: await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: BUCKET, Key: object.key }),
          { expiresIn: PRESIGN_SECONDS },
        ),
      })),
    );
    objects.push(...signed);
  }

  return objects;
}

function buildDownloadShellScript(objectCount: number): string {
  return `#!/usr/bin/env bash
# Downloads every CDN file belonging to this workspace (${objectCount} objects)
# into ./cdn, preserving the original paths.
#
# The URLs in cdn-manifest.json expire 7 days after the export was generated.
# If they have expired, re-run the export from the ReAdmin panel to get fresh
# ones. Requires: bash, curl, python3.
set -euo pipefail

MANIFEST="\${1:-cdn-manifest.json}"
OUT="\${2:-cdn}"

if [ ! -f "$MANIFEST" ]; then
  echo "Manifest not found: $MANIFEST" >&2
  exit 1
fi

python3 - "$MANIFEST" <<'PY' > .cdn-download-list
import json, sys
with open(sys.argv[1]) as fh:
    manifest = json.load(fh)
for entry in manifest["objects"]:
    print(entry["key"] + "\\t" + entry["url"])
PY

total=$(wc -l < .cdn-download-list | tr -d ' ')
current=0
while IFS=$'\\t' read -r key url; do
  current=$((current + 1))
  dest="$OUT/$key"
  mkdir -p "$(dirname "$dest")"
  if [ -f "$dest" ]; then
    echo "[$current/$total] skip (exists) $key"
    continue
  fi
  echo "[$current/$total] $key"
  curl -fsSL --retry 3 --retry-delay 2 -o "$dest" "$url"
done < .cdn-download-list

rm -f .cdn-download-list
echo "Done. Files are in $OUT/"
`;
}

function buildDownloadPowerShellScript(objectCount: number): string {
  return `# Downloads every CDN file belonging to this workspace (${objectCount} objects)
# into .\\cdn, preserving the original paths.
#
# The URLs in cdn-manifest.json expire 7 days after the export was generated.
# If they have expired, re-run the export from the ReAdmin panel.
param(
  [string]$Manifest = "cdn-manifest.json",
  [string]$Out = "cdn"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Manifest)) {
  Write-Error "Manifest not found: $Manifest"
  exit 1
}

$data = Get-Content $Manifest -Raw | ConvertFrom-Json
$total = $data.objects.Count
$current = 0

foreach ($entry in $data.objects) {
  $current++
  $dest = Join-Path $Out $entry.key
  $dir = Split-Path $dest -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (Test-Path $dest) {
    Write-Host "[$current/$total] skip (exists) $($entry.key)"
    continue
  }
  Write-Host "[$current/$total] $($entry.key)"
  Invoke-WebRequest -Uri $entry.url -OutFile $dest -UseBasicParsing
}

Write-Host "Done. Files are in $Out\\"
`;
}

function buildReadme(
  job: MongoTypes.WorkspaceExport,
  groupName: string | undefined,
  cdnObjectCount: number,
): string {
  return `# ReAdmin export — ${groupName ?? job.groupId} (group ${job.groupId})

Generated ${new Date().toISOString()} by ${job.requestedByName ?? job.requestedByRobloxId}.

This is a complete copy of everything ReAdmin held for this workspace.

## What is in here

- \`manifest.json\` — index of every file, with record counts per collection.
- \`data/*.ndjson\` — one file per collection (split into numbered parts for
  large ones). Each line is a single document in MongoDB Extended JSON, so
  ObjectIds and dates keep their real types.
- \`cdn-manifest.json\` — every uploaded file this workspace owns (${cdnObjectCount}
  objects): images, application attachments, hub files, team documents.
- \`download-cdn.sh\` / \`download-cdn.ps1\` — fetch all of those into \`./cdn\`.

## Get your files before the links expire

The download URLs in \`cdn-manifest.json\` are valid for **7 days** from the time
this export was generated. Run one of the download scripts from this folder:

    bash download-cdn.sh          # macOS / Linux
    ./download-cdn.ps1            # Windows PowerShell

Both skip files already downloaded, so they are safe to re-run if interrupted.
If the links have expired, generate a fresh export from the ReAdmin panel.

## Loading this into a self-hosted ReAdmin

Open Settings → Data Export on your own instance and use the import panel.
Select this whole folder — it reads \`manifest.json\`, then loads each
\`data/*.ndjson\` file. Documents are matched on \`_id\`, so importing twice is
safe and a failed import can simply be re-run.

To restore the files as well, download them first (above), then point the
importer's file upload at the \`cdn\` folder.

## Reading it without ReAdmin

The NDJSON files are plain text, one JSON document per line. To load a
collection straight into your own MongoDB:

    mongoimport --db mydb --collection group_member \\
      --file data/group_member.part-0001.ndjson

## A note on sensitive files

Some collections contain credentials — \`ranking_key\`, \`roblox_bots\`,
\`discord_bots\`, \`group_oauth_authorization\` and the workspace document itself.
Treat this export as secret, and rotate anything you intend to keep using.
`;
}

/**
 * Run an export job to completion. Fire-and-forget: the caller inserts the job
 * document, kicks this off, and the UI polls the job for progress.
 */
export async function generateWorkspaceExport(processId: string): Promise<void> {
  const job = await readminCollections.workspace_export.findOne({ processId });
  if (!job) throw new Error(`Workspace export ${processId} not found`);

  const { groupId } = job;

  try {
    await patchJob(processId, { status: 'running', stage: 'Preparing' });

    const workspace = await readminCollections.workspace.findOne(
      { groupId },
      { projection: { groupName: 1 } },
    );

    const scope = await resolveWorkspaceScope(groupId);

    // Resume rather than restart. A previous run may have been cut short by a
    // serverless timeout or a deploy; everything it finished is kept, and only
    // the data files are carried over (the manifest and scripts are rewritten
    // from scratch at the end of every run).
    const completedCollections = new Set(job.completedCollections ?? []);
    const files: MongoTypes.WorkspaceExportFile[] = (job.files ?? []).filter((file) =>
      file.name.startsWith('data/'),
    );
    const counts: Record<string, number> = { ...(job.counts ?? {}) };
    let totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
    let collectionsDone = completedCollections.size;

    // One collection at a time — the single most important thing keeping this
    // from overwhelming the database.
    for (const spec of WORKSPACE_COLLECTIONS) {
      if (completedCollections.has(spec.key)) continue;

      await patchJob(processId, {
        stage: `Exporting ${spec.label}`,
        collectionsDone,
        counts,
        totalRecords,
      });

      const { files: written, records } = await exportCollection(spec, scope, processId);

      if (records > 0) {
        counts[spec.key] = records;
        totalRecords += records;
        files.push(...written);
      }
      collectionsDone += 1;
      completedCollections.add(spec.key);

      // Recorded per collection so an interrupted run resumes from here.
      await patchJob(processId, {
        completedCollections: [...completedCollections],
        collectionsDone,
        counts,
        totalRecords,
        files,
      });
    }

    await patchJob(processId, {
      stage: 'Listing CDN files',
      collectionsDone,
      counts,
      totalRecords,
    });

    const cdnObjects = await listWorkspaceCdnObjects(groupId);
    const cdnTotalBytes = cdnObjects.reduce((sum, object) => sum + object.bytes, 0);
    const urlsExpireAt = new Date(Date.now() + PRESIGN_SECONDS * 1000);

    await patchJob(processId, { stage: 'Writing manifest' });

    const cdnManifest = {
      generatedAt: new Date().toISOString(),
      groupId,
      groupName: workspace?.groupName,
      objectCount: cdnObjects.length,
      totalBytes: cdnTotalBytes,
      urlsExpireAt: urlsExpireAt.toISOString(),
      objects: cdnObjects.map((object) => ({
        key: object.key,
        bytes: object.bytes,
        lastModified: object.lastModified?.toISOString(),
        url: object.url,
      })),
    };

    files.push(
      await putBundleFile(
        groupId,
        processId,
        'cdn-manifest.json',
        JSON.stringify(cdnManifest, null, 2),
        'application/json',
      ),
    );
    files.push(
      await putBundleFile(
        groupId,
        processId,
        'download-cdn.sh',
        buildDownloadShellScript(cdnObjects.length),
        'text/x-shellscript',
      ),
    );
    files.push(
      await putBundleFile(
        groupId,
        processId,
        'download-cdn.ps1',
        buildDownloadPowerShellScript(cdnObjects.length),
        'text/plain',
      ),
    );
    files.push(
      await putBundleFile(
        groupId,
        processId,
        'README.md',
        buildReadme(job, workspace?.groupName, cdnObjects.length),
        'text/markdown',
      ),
    );

    // The index the importer reads. Written last so its presence means the
    // bundle is complete.
    const manifest = {
      format: 'readmin-workspace-export/v1',
      generatedAt: new Date().toISOString(),
      groupId,
      groupName: workspace?.groupName,
      processId,
      totalRecords,
      counts,
      collections: WORKSPACE_COLLECTIONS.filter((spec) => counts[spec.key]).map((spec) => ({
        key: spec.key,
        label: spec.label,
        records: counts[spec.key],
        sensitive: !!spec.sensitive,
        files: files.filter((file) => file.name.startsWith(`data/${spec.key}.part-`)).map((f) => f.name),
      })),
      cdn: {
        objectCount: cdnObjects.length,
        totalBytes: cdnTotalBytes,
        urlsExpireAt: urlsExpireAt.toISOString(),
      },
      files: files.map((file) => ({ name: file.name, bytes: file.bytes, records: file.records })),
    };

    files.push(
      await putBundleFile(
        groupId,
        processId,
        'manifest.json',
        JSON.stringify(manifest, null, 2),
        'application/json',
      ),
    );

    await patchJob(processId, {
      status: 'finished',
      stage: 'Complete',
      collectionsDone,
      completedCollections: [...completedCollections],
      counts,
      totalRecords,
      files,
      cdnObjectCount: cdnObjects.length,
      cdnTotalBytes,
      urlsExpireAt,
      completed: new Date(),
    });
  } catch (error: any) {
    console.error(`Workspace export ${processId} failed:`, error);
    await patchJob(processId, {
      status: 'failed',
      error: error?.message ? String(error.message).slice(0, 500) : 'Unknown error',
      completed: new Date(),
    }).catch(() => {});
    throw error;
  }
}

/** Presign a finished bundle's files so the browser can download them. */
export async function presignExportFiles(
  files: MongoTypes.WorkspaceExportFile[],
  expiresInSeconds = 60 * 60,
): Promise<(MongoTypes.WorkspaceExportFile & { url: string })[]> {
  const out: (MongoTypes.WorkspaceExportFile & { url: string })[] = [];
  for (let i = 0; i < files.length; i += PRESIGN_CONCURRENCY) {
    const chunk = files.slice(i, i + PRESIGN_CONCURRENCY);
    const signed = await Promise.all(
      chunk.map(async (file) => ({
        ...file,
        url: await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: BUCKET, Key: file.key }),
          { expiresIn: expiresInSeconds },
        ),
      })),
    );
    out.push(...signed);
  }
  return out;
}
