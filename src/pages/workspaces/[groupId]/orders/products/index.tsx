import { useRouter } from 'next/router';
import { ReactElement, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilSquareIcon,
  ArchiveBoxIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TagIcon,
} from '@heroicons/react/20/solid';
import { useWorkspace } from '~/components/contexts/workspace';
import OrdersLayout from '~/components/page_components/workspaces/orders/OrdersLayout';
import { ordersAccess } from '~/components/page_components/workspaces/orders/access';
import { OrdersGate, formatMoney } from '~/components/page_components/workspaces/orders/shared';
import ProductModal from '~/components/page_components/workspaces/orders/ProductModal';
import CategoryManager from '~/components/page_components/workspaces/orders/CategoryManager';
import PageHeading from '~/components/layouts/PageHeading';
import Card from '~/components/ui/Card';
import Badge from '~/components/ui/Badge';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import DataTable, { DataTableColumn } from '~/components/ui/DataTable';
import { useConfirm } from '~/components/ui/ConfirmModal';
import { trpc } from '~/utils/trpc';
import { Product } from '~/services/NewMongoTypes';

function ProductThumb({ groupId, assetId, enabled }: { groupId: string; assetId?: string; enabled: boolean }) {
  const { data } = trpc.workspaces.workspace.orders.products.getAssetThumbnail.useQuery(
    { groupId, assetId: assetId || '' },
    { enabled: enabled && !!assetId, staleTime: 10 * 60 * 1000 },
  );
  if (data?.state === 'Completed' && data.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={data.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover" />;
  }
  return <div className="h-9 w-9 rounded-md bg-gray-100 dark:bg-gray-700" />;
}

export default function ProductsPage() {
  const router = useRouter();
  const { groupId } = router.query as { groupId: string };
  const workspace = useWorkspace();
  const access = ordersAccess(workspace);
  const allowed = access.manageProducts || access.manage;
  const canQuery = !!groupId && access.moduleEnabled && access.view;
  const utils = trpc.useUtils();
  const [confirm, ConfirmDialog] = useConfirm();

  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const { data: products, isPending } = trpc.workspaces.workspace.orders.products.list.useQuery(
    { groupId, includeArchived },
    { enabled: canQuery },
  );
  const { data: categories } = trpc.workspaces.workspace.orders.products.listCategories.useQuery(
    { groupId },
    { enabled: canQuery },
  );
  const { data: posConfig } = trpc.workspaces.workspace.orders.pos.getConfig.useQuery(
    { groupId },
    { enabled: canQuery },
  );
  const currencySymbol = posConfig?.default?.pricing?.currencySymbol || '$';

  const categoryName = (id?: string) =>
    id ? categories?.find((c) => c._id!.toString() === id)?.name || 'Unknown' : '—';

  const queueName = (id: string) => posConfig?.default?.queues?.find((q) => q.id === id)?.name || id;

  const setEnabledMut = trpc.workspaces.workspace.orders.products.setEnabled.useMutation();
  const archiveMut = trpc.workspaces.workspace.orders.products.archive.useMutation();
  const reorderMut = trpc.workspaces.workspace.orders.products.reorder.useMutation();

  const invalidate = () => utils.workspaces.workspace.orders.products.list.invalidate({ groupId });

  const toggleEnabled = (p: Product, enabled: boolean) => {
    const promise = setEnabledMut.mutateAsync({ groupId, productId: p._id!.toString(), enabled }).then(invalidate);
    toast.promise(promise, {
      loading: 'Updating…',
      success: enabled ? 'Product enabled' : 'Product disabled',
      error: (e) => e?.message || 'Failed to update.',
    });
  };

  const archive = async (p: Product) => {
    const ok = await confirm({
      title: `Archive "${p.name}"?`,
      body: 'It will be hidden from the POS. Historical orders keep their snapshot.',
      confirmText: 'Archive',
      destructive: true,
    });
    if (!ok) return;
    const promise = archiveMut.mutateAsync({ groupId, productId: p._id!.toString() }).then(invalidate);
    toast.promise(promise, { loading: 'Archiving…', success: 'Product archived', error: (e) => e?.message || 'Failed.' });
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!products) return;
    const target = index + dir;
    if (target < 0 || target >= products.length) return;
    const next = [...products];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    const orderedIds = next.map((p) => p._id!.toString());
    const promise = reorderMut.mutateAsync({ groupId, orderedIds }).then(invalidate);
    toast.promise(promise, { loading: 'Reordering…', success: 'Order updated', error: (e) => e?.message || 'Failed.' });
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setProductModalOpen(true);
  };
  const openCreate = () => {
    setEditing(null);
    setProductModalOpen(true);
  };

  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        key: 'thumb',
        header: '',
        width: 'w-12',
        cell: (p) => <ProductThumb groupId={groupId} assetId={p.imageAssetId} enabled={canQuery} />,
      },
      {
        key: 'name',
        header: 'Name',
        cell: (p) => (
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
            <div className="flex flex-wrap gap-1">
              {p.archived && <Badge color="light">Archived</Badge>}
              {p.queues && p.queues.length > 0 && (
                <Badge color="blue">{p.queues.map(queueName).join(', ')}</Badge>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        cell: (p) => <span className="text-gray-600 dark:text-gray-300">{categoryName(p.categoryId?.toString())}</span>,
      },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        cell: (p) => formatMoney(p.price, currencySymbol),
      },
      {
        key: 'enabled',
        header: 'Enabled',
        align: 'center',
        cell: (p) =>
          access.manageProducts ? (
            <div className="flex justify-center">
              <Toggle value={p.enabled} onChange={(v) => toggleEnabled(p, v)} />
            </div>
          ) : (
            <Badge color={p.enabled ? 'green' : 'light'}>{p.enabled ? 'On' : 'Off'}</Badge>
          ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        cell: (p, i) =>
          access.manageProducts ? (
            <div className="flex items-center justify-end gap-1">
              {!includeArchived && (
                <>
                  <Button variant="discrete" icon={ChevronUpIcon} onClick={() => move(i, -1)} disabled={i === 0 || reorderMut.isPending} />
                  <Button
                    variant="discrete"
                    icon={ChevronDownIcon}
                    onClick={() => move(i, 1)}
                    disabled={i === (products?.length || 0) - 1 || reorderMut.isPending}
                  />
                </>
              )}
              <Button variant="discrete" icon={PencilSquareIcon} onClick={() => openEdit(p)} />
              {!p.archived && <Button variant="light_danger" icon={ArchiveBoxIcon} onClick={() => archive(p)} />}
            </div>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupId, canQuery, categories, currencySymbol, includeArchived, products, access.manageProducts, posConfig],
  );

  return (
    <OrdersGate
      moduleEnabled={access.moduleEnabled}
      allowed={access.view && allowed}
      groupId={groupId}
      canEnable={!!workspace?.department?.permissions?.admin}
    >
      {ConfirmDialog}
      <PageHeading title="Products" description="Manage your POS catalog and categories.">
        {access.manageProducts && (
          <div className="flex flex-wrap gap-2">
            <Button variant="discrete" icon={TagIcon} onClick={() => setCategoryModalOpen(true)}>
              Categories
            </Button>
            <Button variant="primary" icon={PlusIcon} onClick={openCreate}>
              New product
            </Button>
          </div>
        )}
      </PageHeading>

      <div className="mt-4 flex items-center justify-end">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      <div className="mt-3">
        <DataTable<Product>
          columns={columns}
          rows={products}
          loading={isPending}
          rowKey={(p) => p._id!.toString()}
          emptyState="No products yet. Create your first product to start selling."
        />
      </div>

      <ProductModal
        open={productModalOpen}
        setOpen={setProductModalOpen}
        groupId={groupId}
        product={editing}
        categories={categories || []}
        queues={posConfig?.default?.queues || []}
      />
      <CategoryManager
        open={categoryModalOpen}
        setOpen={setCategoryModalOpen}
        groupId={groupId}
        categories={categories || []}
      />
    </OrdersGate>
  );
}

ProductsPage.getLayout = (page: ReactElement) => <OrdersLayout disablePadding={false}>{page}</OrdersLayout>;
