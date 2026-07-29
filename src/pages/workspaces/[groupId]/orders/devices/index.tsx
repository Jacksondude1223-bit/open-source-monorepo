import { useRouter } from 'next/router';
import { ReactElement, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilSquareIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ClipboardIcon,
  CheckIcon,
} from '@heroicons/react/20/solid';
import { useWorkspace } from '~/components/contexts/workspace';
import OrdersLayout from '~/components/page_components/workspaces/orders/OrdersLayout';
import { ordersAccess } from '~/components/page_components/workspaces/orders/access';
import { OrdersGate } from '~/components/page_components/workspaces/orders/shared';
import DeviceModal from '~/components/page_components/workspaces/orders/DeviceModal';
import PageHeading from '~/components/layouts/PageHeading';
import Badge from '~/components/ui/Badge';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import DataTable, { DataTableColumn } from '~/components/ui/DataTable';
import { trpc } from '~/utils/trpc';
import { DeviceProfile, DeviceType, DeviceDisplayMode } from '~/services/NewMongoTypes';

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  register: 'Register',
  kiosk: 'Kiosk',
  board: 'Board',
  bumpbar: 'Bump bar',
  scanner: 'Scanner',
  drivethru: 'Drive-thru',
};

const DISPLAY_LABELS: Record<DeviceDisplayMode, string> = {
  prompt: 'Prompt',
  surface: 'Surface',
  both: 'Both',
};

/** Monospace key cell with a copy-to-clipboard button. */
function KeyCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => toast.error('Could not copy.'));
  };
  return (
    <div className="flex items-center gap-1.5">
      <code className="font-mono text-xs text-gray-700 dark:text-gray-300">{value}</code>
      <button
        type="button"
        onClick={copy}
        title="Copy key"
        className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function DevicesPage() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const access = ordersAccess(workspace);
  const canManage = access.manageSettings;
  const canQuery = !!groupId && access.moduleEnabled && access.view;
  const utils = trpc.useUtils();

  const [editing, setEditing] = useState<DeviceProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: devices, isPending } = trpc.workspaces.workspace.orders.devices.list.useQuery(
    { groupId },
    { enabled: canQuery },
  );
  const { data: posConfig } = trpc.workspaces.workspace.orders.pos.getConfig.useQuery(
    { groupId },
    { enabled: canQuery },
  );

  const queues = posConfig?.default?.queues || [];
  const queueName = (id?: string) => (id ? queues.find((q) => q.id === id)?.name || id : '—');

  const updateMut = trpc.workspaces.workspace.orders.devices.update.useMutation();
  const reorderMut = trpc.workspaces.workspace.orders.devices.reorder.useMutation();

  const invalidate = () => utils.workspaces.workspace.orders.devices.list.invalidate({ groupId });

  const toggleEnabled = (d: DeviceProfile, enabled: boolean) => {
    const promise = updateMut
      .mutateAsync({ groupId, profileId: d._id!.toString(), profile: { enabled } })
      .then(invalidate);
    toast.promise(promise, {
      loading: 'Updating…',
      success: enabled ? 'Device enabled' : 'Device disabled',
      error: (e) => e?.message || 'Failed to update.',
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!devices) return;
    const target = index + dir;
    if (target < 0 || target >= devices.length) return;
    const next = [...devices];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    const orderedIds = next.map((d) => d._id!.toString());
    const promise = reorderMut.mutateAsync({ groupId, orderedIds }).then(invalidate);
    toast.promise(promise, { loading: 'Reordering…', success: 'Order updated', error: (e) => e?.message || 'Failed.' });
  };

  const openEdit = (d: DeviceProfile) => {
    setEditing(d);
    setModalOpen(true);
  };
  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const columns = useMemo<DataTableColumn<DeviceProfile>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        cell: (d) => <span className="font-medium text-gray-900 dark:text-gray-100">{d.name}</span>,
      },
      {
        key: 'key',
        header: 'Key',
        cell: (d) => <KeyCell value={d.key} />,
      },
      {
        key: 'type',
        header: 'Type',
        cell: (d) => <Badge color="blue">{DEVICE_TYPE_LABELS[d.deviceType] || d.deviceType}</Badge>,
      },
      {
        key: 'queue',
        header: 'Queue',
        cell: (d) => <span className="text-gray-600 dark:text-gray-300">{queueName(d.queueId)}</span>,
      },
      {
        key: 'display',
        header: 'Display',
        cell: (d) => (d.display ? <Badge color="light">{DISPLAY_LABELS[d.display]}</Badge> : <span className="text-gray-400">—</span>),
      },
      {
        key: 'enabled',
        header: 'Enabled',
        align: 'center',
        cell: (d) =>
          canManage ? (
            <div className="flex justify-center">
              <Toggle value={d.enabled} onChange={(v) => toggleEnabled(d, v)} />
            </div>
          ) : (
            <Badge color={d.enabled ? 'green' : 'light'}>{d.enabled ? 'On' : 'Off'}</Badge>
          ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        cell: (d, i) =>
          canManage ? (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="discrete"
                icon={ChevronUpIcon}
                onClick={() => move(i, -1)}
                disabled={i === 0 || reorderMut.isPending}
              />
              <Button
                variant="discrete"
                icon={ChevronDownIcon}
                onClick={() => move(i, 1)}
                disabled={i === (devices?.length || 0) - 1 || reorderMut.isPending}
              />
              <Button variant="discrete" icon={PencilSquareIcon} onClick={() => openEdit(d)} />
            </div>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage, devices, queues, reorderMut.isPending],
  );

  return (
    <OrdersGate
      moduleEnabled={access.moduleEnabled}
      allowed={access.view}
      groupId={groupId}
      canEnable={!!workspace?.department?.permissions?.admin}
    >
      <PageHeading
        title="Devices"
        description="Configure your in-game POS devices here — no Studio edits. Tag a part and point it at a profile."
      >
        {canManage && (
          <Button variant="primary" icon={PlusIcon} onClick={openCreate}>
            New device
          </Button>
        )}
      </PageHeading>

      <div className="mt-3">
        <DataTable<DeviceProfile>
          columns={columns}
          rows={devices}
          loading={isPending}
          rowKey={(d) => d._id!.toString()}
          emptyState={
            <div className="flex flex-col items-center gap-3">
              <span>No devices yet. Define a profile once on the web and reuse it across every part.</span>
              {canManage && (
                <Button variant="primary" icon={PlusIcon} onClick={openCreate}>
                  Create your first device
                </Button>
              )}
            </div>
          }
        />
      </div>

      <DeviceModal
        open={modalOpen}
        setOpen={setModalOpen}
        groupId={groupId}
        device={editing}
        queues={queues}
      />
    </OrdersGate>
  );
}

DevicesPage.getLayout = (page: ReactElement) => <OrdersLayout disablePadding={false}>{page}</OrdersLayout>;
