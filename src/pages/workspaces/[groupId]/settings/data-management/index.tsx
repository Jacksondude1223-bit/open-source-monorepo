/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import Button from '~/components/forms/Button';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';
import ReactTimeago from 'react-timeago';

export default function DataManagementPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();

  const [queryInput, setQueryInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const search = trpc.workspaces.workspace.settings.dataManagement.search.useQuery(
    { groupId, query: submittedQuery ?? '' },
    { enabled: !!groupId && !!submittedQuery, retry: false },
  );
  const exportMutation = trpc.workspaces.workspace.settings.dataManagement.export.useMutation();
  const deleteMutation = trpc.workspaces.workspace.settings.dataManagement.delete.useMutation();
  const logsQuery = trpc.workspaces.workspace.settings.dataManagement.recentLogs.useQuery(
    { groupId },
    { enabled: !!groupId },
  );

  if (!user || !workspace) {
    return <LoadingPage />;
  }

  const runSearch = () => {
    const q = queryInput.trim();
    if (!q) return;
    setConfirmingDelete(null);
    setSubmittedQuery(q);
  };

  const handleExport = (userKey: string) => {
    exportMutation
      .mutateAsync({ groupId, userKey })
      .then((bundle) => {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `readmin-data-${userKey}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported data');
        logsQuery.refetch();
      })
      .catch((err) => toast.error(err.message));
  };

  const handleDelete = (userKey: string) => {
    deleteMutation
      .mutateAsync({ groupId, userKey, confirm: true })
      .then((result) => {
        const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
        toast.success(`Deleted ${total} record${total === 1 ? '' : 's'} and opted the player out`);
        setConfirmingDelete(null);
        search.refetch();
        logsQuery.refetch();
      })
      .catch((err) => toast.error(err.message));
  };

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Data Management`}
        description="Action player data-access and deletion requests"
      />

      <Card className="mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          When a player asks to access or delete the activity data your games collected about
          them, find them here by Roblox user ID, identity key, or username. Exporting downloads
          everything tracked for them in this workspace; deleting removes it and permanently opts
          them out of future tracking here. Every action is recorded below.
        </p>
      </Card>

      <Card className="mt-4 flex flex-col gap-3">
        <label htmlFor="dm-q" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Find a player
        </label>
        <div className="flex gap-2">
          <input
            id="dm-q"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            placeholder="Roblox ID, identity key, or username"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <Button variant="primary" type="button" onClick={runSearch} disabled={!queryInput.trim()}>
            Search
          </Button>
        </div>
      </Card>

      {submittedQuery && (
        <div className="mt-4 flex flex-col gap-3">
          {search.isLoading ? (
            <p className="text-sm text-gray-500">Searching…</p>
          ) : search.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{search.error.message}</p>
          ) : search.data && search.data.length > 0 ? (
            search.data.map((subject) => (
              <Card key={subject.canonicalKey} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {subject.thumbnailUrl ? (
                    <img src={subject.thumbnailUrl} alt="" className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {subject.displayName || subject.username || subject.canonicalKey}
                      {subject.username ? <span className="text-gray-400 font-normal"> @{subject.username}</span> : null}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      <span className="font-mono">{subject.keys.join(', ')}</span>
                      {subject.globalUserId ? ` · global ID ${subject.globalUserId}` : ''}
                    </div>
                  </div>
                  {subject.consentStatus && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${subject.consentStatus === 'denied'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                      {subject.consentStatus === 'denied' ? 'Opted out' : 'Consented'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{subject.sessionCount} session{subject.sessionCount === 1 ? '' : 's'} tracked here</span>
                  {subject.lastSeen ? <span>last seen <ReactTimeago date={subject.lastSeen} /></span> : null}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                  <Button variant="blue" type="button" onClick={() => handleExport(subject.canonicalKey)} disabled={exportMutation.isPending}>
                    {exportMutation.isPending ? 'Exporting…' : 'Export data (JSON)'}
                  </Button>
                  {/* {confirmingDelete === subject.canonicalKey ? (
                    <>
                      <Button variant="danger" type="button" onClick={() => handleDelete(subject.canonicalKey)} disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete + opt out'}
                      </Button>
                      <Button variant="discrete" type="button" onClick={() => setConfirmingDelete(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="light_danger" type="button" onClick={() => setConfirmingDelete(subject.canonicalKey)}>
                      Delete all data
                    </Button>
                  )} */}
                </div>
              </Card>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No tracked players matched that search.</p>
          )}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Recent data requests</h2>
        {logsQuery.data && logsQuery.data.length > 0 ? (
          <div className="flex flex-col gap-2">
            {logsQuery.data.map((log) => {
              const total = Object.values(log.counts).reduce((a, b) => a + b, 0);
              return (
                <Card key={log._id?.toString()} className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className={`font-medium ${log.action === 'delete' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {log.action === 'delete' ? 'Deleted' : 'Exported'}
                    </span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">
                      {total} record{total === 1 ? '' : 's'} for <span className="font-mono">{log.subjectUserKey}</span>
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">by {log.actorName || log.actorRobloxId}</div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    <ReactTimeago date={log.created} />
                  </span>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No data requests yet.</p>
        )}
      </div>
    </>
  );
}

DataManagementPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
