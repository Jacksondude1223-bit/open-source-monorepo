import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '~/components/ui/Modal';
import Header from '~/components/NextGenStyles/Header';
import Button from '~/components/forms/Button';
import { trpc } from '~/utils/trpc';
import { Product, ProductCategory } from '~/services/NewMongoTypes';
import AssetThumbnail from './AssetThumbnail';

type ProductFormState = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  toolName: string;
  barcodeId: string;
  imageAssetId: string;
  queues: string[];
};

const EMPTY: ProductFormState = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  toolName: '',
  barcodeId: '',
  imageAssetId: '',
  queues: [],
};

const fieldClass =
  'mt-1 block w-full rounded-md border-gray-300 dark:bg-gray-800 dark:border-gray-600 py-2 px-2 focus:border-blue-500 focus:ring-blue-500 dark:text-gray-200 sm:text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';

/** Create / edit modal for a catalog product. */
export default function ProductModal({
  open,
  setOpen,
  groupId,
  product,
  categories,
  queues,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  product: Product | null; // null = create
  categories: ProductCategory[];
  queues: { id: string; name: string }[]; // workspace queues, for queue-locking
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<ProductFormState>(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name,
        description: product.description || '',
        price: product.price !== undefined ? String(product.price) : '',
        categoryId: product.categoryId?.toString() || '',
        toolName: product.toolName || '',
        barcodeId: product.barcodeId || '',
        imageAssetId: product.imageAssetId || '',
        queues: product.queues || [],
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, product]);

  const createMut = trpc.workspaces.workspace.orders.products.create.useMutation();
  const updateMut = trpc.workspaces.workspace.orders.products.update.useMutation();

  const set = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleQueue = (id: string) =>
    setForm((f) => ({
      ...f,
      queues: f.queues.includes(id) ? f.queues.filter((q) => q !== id) : [...f.queues, id],
    }));

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('A product name is required.');
      return;
    }
    const priceNum = form.price.trim() === '' ? undefined : Number(form.price);
    if (priceNum !== undefined && (Number.isNaN(priceNum) || priceNum < 0)) {
      toast.error('Price must be a non-negative number.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: priceNum,
      categoryId: form.categoryId || undefined,
      toolName: form.toolName.trim() || undefined,
      barcodeId: form.barcodeId.trim() || undefined,
      imageAssetId: form.imageAssetId.trim() || undefined,
      queues: form.queues,
    };

    const invalidate = () => {
      utils.workspaces.workspace.orders.products.list.invalidate({ groupId });
      setOpen(false);
    };

    const promise = product
      ? updateMut.mutateAsync({ groupId, productId: product._id!.toString(), product: payload }).then(invalidate)
      : createMut.mutateAsync({ groupId, product: payload }).then(invalidate);

    toast.promise(promise, {
      loading: product ? 'Saving product…' : 'Creating product…',
      success: product ? 'Product saved' : 'Product created',
      error: (e) => e?.message || 'Failed to save product.',
    });
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="2xl">
      <Header>{product ? 'Edit product' : 'New product'}</Header>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Name</label>
          <input className={fieldClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Cheeseburger" />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea
            className={fieldClass}
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className={labelClass}>Price (optional)</label>
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            placeholder="Leave blank for free"
          />
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <select className={fieldClass} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c._id!.toString()} value={c._id!.toString()}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Tool name (optional)</label>
          <input
            className={fieldClass}
            value={form.toolName}
            onChange={(e) => set('toolName', e.target.value)}
            placeholder="Tool to hand the customer"
          />
        </div>

        <div>
          <label className={labelClass}>Barcode id (optional)</label>
          <input
            className={fieldClass}
            value={form.barcodeId}
            onChange={(e) => set('barcodeId', e.target.value)}
            placeholder="Scan code for retail mode"
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Available on queues</label>
          {queues.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No queues yet — add queues in Orders → Settings to restrict where this product sells.
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-2">
                {queues.map((q) => {
                  const active = form.queues.includes(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => toggleQueue(q.id)}
                      className={
                        'rounded-full border px-3 py-1 text-sm transition ' +
                        (active
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300')
                      }
                    >
                      {q.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {form.queues.length === 0
                  ? 'Sold on every queue. Select queues to lock it to only those.'
                  : `Locked to ${form.queues.length} queue${form.queues.length === 1 ? '' : 's'}.`}
              </p>
            </>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Image asset id (optional)</label>
          <div className="mt-1 flex items-center gap-3">
            <input
              className="block w-full rounded-md border-gray-300 px-2 py-2 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:text-sm"
              value={form.imageAssetId}
              onChange={(e) => set('imageAssetId', e.target.value)}
              placeholder="Roblox image / decal asset id"
            />
            <AssetThumbnail groupId={groupId} assetId={form.imageAssetId} size={14} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="discrete" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={saving}>
          {product ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </Modal>
  );
}
