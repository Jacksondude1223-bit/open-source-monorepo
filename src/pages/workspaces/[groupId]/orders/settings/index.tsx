import { useRouter } from 'next/router';
import { ReactElement, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '~/components/contexts/workspace';
import OrdersLayout from '~/components/page_components/workspaces/orders/OrdersLayout';
import { ordersAccess } from '~/components/page_components/workspaces/orders/access';
import { OrdersGate } from '~/components/page_components/workspaces/orders/shared';
import PosConfigEditor, { PosConfigDraft, toDraft } from '~/components/page_components/workspaces/orders/PosConfigEditor';
import PageHeading from '~/components/layouts/PageHeading';
import LoadingPage from '~/components/layouts/LoadingPage';
import Button from '~/components/forms/Button';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { useConfirm } from '~/components/ui/ConfirmModal';
import { trpc } from '~/utils/trpc';

type Tab = 'default' | 'perGame';

export default function PosSettingsPage() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const access = ordersAccess(workspace);
  const canQuery = !!groupId && access.moduleEnabled && access.manageSettings;
  const utils = trpc.useUtils();
  const [confirm, ConfirmDialog] = useConfirm();

  const [tab, setTab] = useState<Tab>('default');

  const { data: config, isPending } = trpc.workspaces.workspace.orders.pos.getConfig.useQuery(
    { groupId },
    { enabled: canQuery },
  );

  // ── Default config draft ─────────────────────────────────────────────────
  const [defaultDraft, setDefaultDraft] = useState<PosConfigDraft | null>(null);
  useEffect(() => {
    if (config?.default) setDefaultDraft(toDraft(config.default));
  }, [config?.default]);

  const updateDefaultMut = trpc.workspaces.workspace.orders.pos.updateDefault.useMutation();
  const saveDefault = () => {
    if (!defaultDraft) return;
    const promise = updateDefaultMut.mutateAsync({ groupId, config: defaultDraft }).then(() => {
      utils.workspaces.workspace.orders.pos.getConfig.invalidate({ groupId });
      utils.workspaces.workspace.orders.pos.getResolvedConfig.invalidate();
    });
    toast.promise(promise, { loading: 'Saving POS config…', success: 'POS config saved', error: (e) => e?.message || 'Failed to save.' });
  };

  // ── Per-game override ────────────────────────────────────────────────────
  const games = config?.games || [];
  const [selectedGameId, setSelectedGameId] = useState('');
  useEffect(() => {
    if (!selectedGameId && games[0]) setSelectedGameId(games[0].gameId);
  }, [games, selectedGameId]);

  const hasOverride = !!config?.overrides?.find((o) => o.gameId === selectedGameId);
  const { data: resolved } = trpc.workspaces.workspace.orders.pos.getResolvedConfig.useQuery(
    { groupId, gameId: selectedGameId },
    { enabled: canQuery && !!selectedGameId && tab === 'perGame' },
  );

  const [gameDraft, setGameDraft] = useState<PosConfigDraft | null>(null);
  useEffect(() => {
    // Seed the per-game editor with the existing override, or the resolved
    // (deep-merged) config as a starting point if no override exists yet.
    if (!selectedGameId) {
      setGameDraft(null);
      return;
    }
    const existing = config?.overrides?.find((o) => o.gameId === selectedGameId);
    if (existing) setGameDraft(toDraft(existing));
    else if (resolved) setGameDraft(toDraft(resolved));
  }, [selectedGameId, config?.overrides, resolved]);

  const upsertMut = trpc.workspaces.workspace.orders.pos.upsertGameOverride.useMutation();
  const deleteMut = trpc.workspaces.workspace.orders.pos.deleteGameOverride.useMutation();

  const saveGame = () => {
    if (!gameDraft || !selectedGameId) return;
    const promise = upsertMut.mutateAsync({ groupId, gameId: selectedGameId, config: gameDraft }).then(() => {
      utils.workspaces.workspace.orders.pos.getConfig.invalidate({ groupId });
      utils.workspaces.workspace.orders.pos.getResolvedConfig.invalidate();
    });
    toast.promise(promise, { loading: 'Saving override…', success: 'Override saved', error: (e) => e?.message || 'Failed to save.' });
  };

  const deleteGame = async () => {
    if (!selectedGameId) return;
    const ok = await confirm({
      title: 'Remove this game override?',
      body: 'The game will fall back to the workspace default config.',
      confirmText: 'Remove override',
      destructive: true,
    });
    if (!ok) return;
    const promise = deleteMut.mutateAsync({ groupId, gameId: selectedGameId }).then(() => {
      utils.workspaces.workspace.orders.pos.getConfig.invalidate({ groupId });
      utils.workspaces.workspace.orders.pos.getResolvedConfig.invalidate();
    });
    toast.promise(promise, { loading: 'Removing…', success: 'Override removed', error: (e) => e?.message || 'Failed to remove.' });
  };

  const TabButton = ({ id, label }: { id: Tab; label: string }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        tab === id
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <OrdersGate
      moduleEnabled={access.moduleEnabled}
      allowed={access.manageSettings}
      groupId={groupId}
      canEnable={!!workspace?.department?.permissions?.admin}
    >
      {ConfirmDialog}
      <PageHeading title="POS Settings" description="Configure the in-game point-of-sale experience." />

      <div className="mt-4 flex gap-2">
        <TabButton id="default" label="Workspace default" />
        <TabButton id="perGame" label="Per-game override" />
      </div>

      {isPending || !config ? (
        <div className="mt-8">
          <LoadingPage override="Loading POS config…" />
        </div>
      ) : tab === 'default' ? (
        <div className="mt-4 space-y-4">
          {defaultDraft && <PosConfigEditor groupId={groupId} draft={defaultDraft} setDraft={setDefaultDraft} />}
          <div className="flex justify-end">
            <Button variant="primary" onClick={saveDefault} disabled={updateDefaultMut.isPending}>
              Save default config
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {games.length === 0 ? (
            <Card>
              <Small>This workspace has no games yet. Add games to create per-game overrides.</Small>
            </Card>
          ) : (
            <>
              <Card>
                <Header>Game</Header>
                <Small className="mt-1 block">Overrides deep-merge onto the workspace default for the selected game.</Small>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <select
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    value={selectedGameId}
                    onChange={(e) => setSelectedGameId(e.target.value)}
                  >
                    {games.map((g) => (
                      <option key={g.gameId} value={g.gameId}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <span className={`text-xs ${hasOverride ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                    {hasOverride ? 'Has override' : 'Using default'}
                  </span>
                  {hasOverride && (
                    <Button variant="light_danger" onClick={deleteGame} disabled={deleteMut.isPending}>
                      Remove override
                    </Button>
                  )}
                </div>
              </Card>

              {gameDraft && <PosConfigEditor groupId={groupId} draft={gameDraft} setDraft={setGameDraft} />}
              <div className="flex justify-end">
                <Button variant="primary" onClick={saveGame} disabled={upsertMut.isPending}>
                  Save override
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </OrdersGate>
  );
}

PosSettingsPage.getLayout = (page: ReactElement) => <OrdersLayout disablePadding={false}>{page}</OrdersLayout>;
