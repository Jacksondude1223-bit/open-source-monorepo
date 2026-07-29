/* eslint-disable @next/next/no-img-element */
import { ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import ReactTimeago from 'react-timeago';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import Button from '~/components/forms/Button';
import Card from '~/components/ui/Card';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import { trpc } from '~/utils/trpc';

/** Matches IMPORT_BATCH_LIMIT on the server. */
const IMPORT_BATCH_SIZE = 500;

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, exponent)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

type ImportProgress = {
  running: boolean;
  file: string;
  done: number;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export default function DataExportPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();

  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);

  const deployment = trpc.workspaces.workspace.settings.dataExport.deployment.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const listQuery = trpc.workspaces.workspace.settings.dataExport.list.useQuery(
    { groupId },
    { enabled: !!groupId },
  );
  const startMutation = trpc.workspaces.workspace.settings.dataExport.start.useMutation();
  const resumeMutation = trpc.workspaces.workspace.settings.dataExport.resume.useMutation();

  const statusQuery = trpc.workspaces.workspace.settings.dataExport.status.useQuery(
    { groupId, processId: activeProcessId ?? '' },
    {
      enabled: !!groupId && !!activeProcessId,
      // Poll while the job is in flight, then stop.
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === 'finished' || status === 'failed' ? false : 2000;
      },
    },
  );

  const validateImport = trpc.workspaces.workspace.settings.dataExport.validateImport.useMutation();
  const importBatch = trpc.workspaces.workspace.settings.dataExport.importBatch.useMutation();
  const importFile = trpc.workspaces.workspace.settings.dataExport.importFile.useMutation();

  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const cdnInputRef = useRef<HTMLInputElement>(null);

  const job = statusQuery.data;
  const isRunning = job?.status === 'pending' || job?.status === 'running';

  const handleStart = useCallback(() => {
    startMutation
      .mutateAsync({ groupId })
      .then((result) => {
        setActiveProcessId(result.processId);
        toast.success('Export started — this can take a few minutes');
        listQuery.refetch();
      })
      .catch((error) => toast.error(error.message));
  }, [groupId, startMutation, listQuery]);

  const handleResume = useCallback(
    (processId: string) => {
      resumeMutation
        .mutateAsync({ groupId, processId })
        .then(() => {
          setActiveProcessId(processId);
          toast.success('Picking up where it left off');
          listQuery.refetch();
        })
        .catch((error) => toast.error(error.message));
    },
    [groupId, resumeMutation, listQuery],
  );

  /**
   * Walk a chosen export folder: read manifest.json, then push every
   * data/*.ndjson file through the import endpoint in batches.
   */
  const handleImportData = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || !fileList.length) return;
      const files = Array.from(fileList);

      const manifestFile = files.find((file) => file.name === 'manifest.json');
      if (!manifestFile) {
        toast.error('No manifest.json found — pick the export folder itself');
        return;
      }

      let summary;
      try {
        summary = await validateImport.mutateAsync({
          groupId,
          manifestJson: await manifestFile.text(),
        });
      } catch (error: any) {
        toast.error(error.message);
        return;
      }

      const dataFiles = files
        .filter((file) => file.name.endsWith('.ndjson'))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!dataFiles.length) {
        toast.error('No .ndjson data files found in that folder');
        return;
      }

      const totals: ImportProgress = {
        running: true,
        file: '',
        done: 0,
        total: dataFiles.length,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      };
      setImportProgress({ ...totals });

      for (const file of dataFiles) {
        // `group_member.part-0001.ndjson` -> `group_member`
        const collectionKey = file.name.split('.part-')[0]?.replace(/\.ndjson$/, '') ?? '';
        totals.file = file.name;
        setImportProgress({ ...totals });

        const lines = (await file.text()).split('\n').filter((line) => line.trim());

        try {
          for (let i = 0; i < lines.length; i += IMPORT_BATCH_SIZE) {
            const result = await importBatch.mutateAsync({
              groupId,
              collectionKey,
              lines: lines.slice(i, i + IMPORT_BATCH_SIZE),
            });
            totals.inserted += result.inserted;
            totals.updated += result.updated;
            totals.skipped += result.skipped;
            if (result.errors.length && totals.errors.length < 20) {
              totals.errors.push(...result.errors.map((e) => `${file.name}: ${e}`));
            }
            setImportProgress({ ...totals });
          }
        } catch (error: any) {
          totals.errors.push(`${file.name}: ${error.message}`);
        }

        totals.done += 1;
        setImportProgress({ ...totals });
      }

      totals.running = false;
      totals.file = '';
      setImportProgress({ ...totals });
      toast.success(
        `Imported ${summary.groupName ?? summary.groupId}: ${totals.inserted} added, ${totals.updated} updated`,
      );
    },
    [groupId, validateImport, importBatch],
  );

  /** Re-upload downloaded CDN files to this instance's own bucket. */
  const handleImportFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || !fileList.length) return;
      const files = Array.from(fileList);

      const totals: ImportProgress = {
        running: true,
        file: '',
        done: 0,
        total: files.length,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
      };
      setImportProgress({ ...totals });

      for (const file of files) {
        // webkitRelativePath keeps the original key, e.g.
        // `cdn/workspaces/123/imgs/.../a.png` — trim everything before it.
        const relative = (file as any).webkitRelativePath || file.name;
        const index = relative.indexOf('workspaces/');
        const key = index >= 0 ? relative.slice(index) : '';

        totals.file = key || relative;
        setImportProgress({ ...totals });

        if (!key) {
          totals.errors.push(`${relative}: could not work out its CDN path, skipped`);
          totals.skipped += 1;
          totals.done += 1;
          continue;
        }

        try {
          const buffer = await file.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }
          await importFile.mutateAsync({
            groupId,
            key,
            base64: btoa(binary),
            contentType: file.type || undefined,
          });
          totals.inserted += 1;
        } catch (error: any) {
          totals.errors.push(`${key}: ${error.message}`);
          totals.skipped += 1;
        }
        totals.done += 1;
        setImportProgress({ ...totals });
      }

      totals.running = false;
      totals.file = '';
      setImportProgress({ ...totals });
      toast.success(`Uploaded ${totals.inserted} file${totals.inserted === 1 ? '' : 's'}`);
    },
    [groupId, importFile],
  );

  const orderedFiles = useMemo(() => {
    if (!job?.files) return [];
    // Put the things people actually open first, data parts after.
    const rank = (name: string) =>
      name === 'README.md' ? 0 : name === 'manifest.json' ? 1 : name.startsWith('cdn-') ? 2 : name.startsWith('download-') ? 3 : 4;
    return [...job.files].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  }, [job?.files]);

  if (!user || !workspace) return <LoadingPage />;

  const progressPercent = job?.collectionsTotal
    ? Math.round((job.collectionsDone / job.collectionsTotal) * 100)
    : 0;

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Data Export`}
        description="Download everything ReAdmin holds for this workspace"
      />

      <Card className="mt-4 border-l-4 border-l-yellow-400">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-yellow-500" />
          <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            <p className="font-medium text-gray-900 dark:text-white">ReAdmin is shutting down.</p>
            <p className="mt-1">
              Export your workspace and keep a copy. The export covers every record we hold —
              members, staff notes, write-ups, sessions, applications, orders, teams, flows and
              activity history — plus a manifest of every file you have uploaded. Download links
              for uploaded files are valid for <strong>7 days</strong>, so run the included
              download script soon after exporting.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Export ─────────────────────────────────────────────────────── */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Export this workspace
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Runs in the background across{' '}
              {deployment.data?.collectionCount ?? 'all'} record types. You can leave this page.
            </p>
          </div>
          <Button
            variant="primary"
            size="medium"
            type="button"
            icon={ArrowDownTrayIcon}
            onClick={handleStart}
            disabled={startMutation.isPending || isRunning}
          >
            {isRunning ? 'Export running…' : startMutation.isPending ? 'Starting…' : 'Start export'}
          </Button>
        </div>

        {job && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            {isRunning && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{job.stage ?? 'Working…'}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {job.collectionsDone}/{job.collectionsTotal}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {job.totalRecords.toLocaleString()} records exported so far
                </p>
              </>
            )}

            {job.status === 'failed' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                  <span>
                    Export failed: {job.error ?? 'unknown error'}
                    {job.collectionsDone > 0 && (
                      <>
                        {' '}
                        Resuming keeps the {job.collectionsDone} record types already exported.
                      </>
                    )}
                  </span>
                </div>
                <Button
                  variant="blue"
                  size="medium"
                  type="button"
                  onClick={() => handleResume(job.processId)}
                  disabled={resumeMutation.isPending}
                >
                  {resumeMutation.isPending ? 'Resuming…' : 'Resume export'}
                </Button>
              </div>
            )}

            {job.status === 'finished' && (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircleIcon className="h-5 w-5 shrink-0" />
                  <span>
                    Done — {job.totalRecords.toLocaleString()} records across{' '}
                    {Object.keys(job.counts).length} collections, plus{' '}
                    {job.cdnObjectCount.toLocaleString()} uploaded files (
                    {formatBytes(job.cdnTotalBytes)}).
                  </span>
                </div>

                <div className="mt-4 grid gap-1 max-h-96 overflow-y-auto">
                  {orderedFiles.map((file: any) => (
                    <a
                      key={file.name}
                      href={file.url}
                      download
                      className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50"
                    >
                      <span className="truncate font-mono text-blue-600 dark:text-blue-400">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {file.records ? `${file.records.toLocaleString()} records · ` : ''}
                        {formatBytes(file.bytes)}
                      </span>
                    </a>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Download links refresh each time you open this page. Start with{' '}
                  <span className="font-mono">README.md</span>, then run{' '}
                  <span className="font-mono">download-cdn.sh</span> to fetch your uploaded files.
                </p>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── Previous exports ───────────────────────────────────────────── */}
      {!!listQuery.data?.length && (
        <div className="mt-6">
          <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
            Previous exports
          </h2>
          <div className="flex flex-col gap-2">
            {listQuery.data.map((previous) => (
              <Card key={previous.processId} className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <span
                    className={
                      previous.status === 'finished'
                        ? 'font-medium text-green-600 dark:text-green-400'
                        : previous.status === 'failed'
                          ? 'font-medium text-red-600 dark:text-red-400'
                          : 'font-medium text-blue-600 dark:text-blue-400'
                    }
                  >
                    {previous.status === 'finished'
                      ? 'Finished'
                      : previous.status === 'failed'
                        ? 'Failed'
                        : 'Running'}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {' '}
                    · {previous.totalRecords.toLocaleString()} records
                  </span>
                  <div className="mt-0.5 truncate text-xs text-gray-400">
                    by {previous.requestedByName || previous.requestedByRobloxId}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-gray-400">
                    <ReactTimeago date={previous.created} />
                  </span>
                  {previous.status === 'finished' ? (
                    <Button
                      variant="discrete"
                      type="button"
                      onClick={() => setActiveProcessId(previous.processId)}
                    >
                      Open
                    </Button>
                  ) : (
                    // Unfinished: either failed outright, or stalled when the
                    // process serving it went away mid-run.
                    <Button
                      variant="blue"
                      type="button"
                      onClick={() => handleResume(previous.processId)}
                      disabled={resumeMutation.isPending}
                    >
                      Resume
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Import (self-hosted only) ──────────────────────────────────── */}
      {deployment.data?.selfHosted && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
            Import a workspace export
          </h2>

          <Card>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              This is a self-hosted ReAdmin instance, so you can load a bundle exported from
              readmin.app back in. Records are matched on their original ID: anything missing is
              added, anything already here is updated, and nothing is deleted. Importing the same
              bundle twice is safe, so an interrupted import can just be run again.
            </p>

            <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 pt-4 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">1. Records</div>
                  <div className="text-gray-500 dark:text-gray-400">
                    Select the export folder containing <span className="font-mono">manifest.json</span>.
                  </div>
                </div>
                <Button
                  variant="blue"
                  size="medium"
                  type="button"
                  icon={ArrowUpTrayIcon}
                  onClick={() => dataInputRef.current?.click()}
                  disabled={importProgress?.running}
                >
                  Choose export folder
                </Button>
                <input
                  ref={dataInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  // Non-standard but supported everywhere that matters; lets the
                  // admin pick the unzipped export folder in one go.
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  onChange={(event) => {
                    handleImportData(event.target.files);
                    event.target.value = '';
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">2. Uploaded files</div>
                  <div className="text-gray-500 dark:text-gray-400">
                    Select the <span className="font-mono">cdn</span> folder the download script
                    created, to copy files into this instance&apos;s storage.
                  </div>
                </div>
                <Button
                  variant="blue"
                  size="medium"
                  type="button"
                  icon={ArrowUpTrayIcon}
                  onClick={() => cdnInputRef.current?.click()}
                  disabled={importProgress?.running}
                >
                  Choose cdn folder
                </Button>
                <input
                  ref={cdnInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                  onChange={(event) => {
                    handleImportFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
              </div>
            </div>

            {importProgress && (
              <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-700 dark:text-gray-300">
                    {importProgress.running
                      ? importProgress.file || 'Reading…'
                      : 'Import complete'}
                  </span>
                  <span className="shrink-0 text-gray-500 dark:text-gray-400">
                    {importProgress.done}/{importProgress.total}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all"
                    style={{
                      width: `${importProgress.total ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {importProgress.inserted.toLocaleString()} added ·{' '}
                  {importProgress.updated.toLocaleString()} updated ·{' '}
                  {importProgress.skipped.toLocaleString()} skipped
                </p>
                {!!importProgress.errors.length && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded bg-red-50 p-2 dark:bg-red-900/20">
                    {importProgress.errors.map((error, index) => (
                      <div key={index} className="text-xs text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

DataExportPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
