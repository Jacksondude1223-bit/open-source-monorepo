import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { TrashIcon, PencilSquareIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/20/solid';
import Modal from '~/components/ui/Modal';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import Button from '~/components/forms/Button';
import Badge from '~/components/ui/Badge';
import { useConfirm } from '~/components/ui/ConfirmModal';
import { trpc } from '~/utils/trpc';
import { ProductCategory } from '~/services/NewMongoTypes';

const fieldClass =
  'block w-full rounded-md border-gray-300 dark:bg-gray-800 dark:border-gray-600 py-2 px-2 focus:border-blue-500 focus:ring-blue-500 dark:text-gray-200 sm:text-sm';

/** Inline manager for product categories: create / edit / delete / reorder + board-routing tags. */
export default function CategoryManager({
  open,
  setOpen,
  groupId,
  categories,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  groupId: string;
  categories: ProductCategory[];
}) {
  const utils = trpc.useUtils();
  const [confirm, ConfirmDialog] = useConfirm();

  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');

  useEffect(() => {
    if (!open) {
      setEditId(null);
      setNewName('');
      setNewTags('');
    }
  }, [open]);

  const invalidate = () => utils.workspaces.workspace.orders.products.listCategories.invalidate({ groupId });

  const createMut = trpc.workspaces.workspace.orders.products.createCategory.useMutation();
  const updateMut = trpc.workspaces.workspace.orders.products.updateCategory.useMutation();
  const deleteMut = trpc.workspaces.workspace.orders.products.deleteCategory.useMutation();
  const reorderMut = trpc.workspaces.workspace.orders.products.reorderCategories.useMutation();

  const parseTags = (raw: string) =>
    raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const create = () => {
    if (!newName.trim()) {
      toast.error('A category name is required.');
      return;
    }
    const promise = createMut
      .mutateAsync({ groupId, category: { name: newName.trim(), routeToBoardTags: parseTags(newTags) } })
      .then(() => {
        setNewName('');
        setNewTags('');
        invalidate();
      });
    toast.promise(promise, { loading: 'Creating…', success: 'Category created', error: (e) => e?.message || 'Failed.' });
  };

  const startEdit = (c: ProductCategory) => {
    setEditId(c._id!.toString());
    setEditName(c.name);
    setEditTags((c.routeToBoardTags || []).join(', '));
  };

  const saveEdit = () => {
    if (!editId) return;
    if (!editName.trim()) {
      toast.error('A category name is required.');
      return;
    }
    const promise = updateMut
      .mutateAsync({ groupId, categoryId: editId, category: { name: editName.trim(), routeToBoardTags: parseTags(editTags) } })
      .then(() => {
        setEditId(null);
        invalidate();
      });
    toast.promise(promise, { loading: 'Saving…', success: 'Category saved', error: (e) => e?.message || 'Failed.' });
  };

  const remove = async (c: ProductCategory) => {
    const ok = await confirm({
      title: `Delete "${c.name}"?`,
      body: 'Products in this category keep existing but become uncategorised.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const promise = deleteMut.mutateAsync({ groupId, categoryId: c._id!.toString() }).then(invalidate);
    toast.promise(promise, { loading: 'Deleting…', success: 'Category deleted', error: (e) => e?.message || 'Failed.' });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    const orderedIds = next.map((c) => c._id!.toString());
    const promise = reorderMut.mutateAsync({ groupId, orderedIds }).then(invalidate);
    toast.promise(promise, { loading: 'Reordering…', success: 'Order updated', error: (e) => e?.message || 'Failed.' });
  };

  return (
    <Modal open={open} setOpen={setOpen} sizeOverride="2xl">
      {ConfirmDialog}
      <Header>Manage categories</Header>
      <Small className="mt-1 block">Categories drive the POS tabs and prep-board routing. Tags route a category only to boards carrying a matching tag.</Small>

      {/* Create row */}
      <div className="mt-4 flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
          <input className={fieldClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Drinks" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Board tags (comma-separated)</label>
          <input className={fieldClass} value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="barista, drinks" />
        </div>
        <Button variant="primary" icon={PlusIcon} onClick={create} disabled={createMut.isPending}>
          Add
        </Button>
      </div>

      {/* List */}
      <div className="mt-4 space-y-2">
        {categories.length === 0 && <Small>No categories yet.</Small>}
        {categories.map((c, i) => {
          const id = c._id!.toString();
          const editing = editId === id;
          return (
            <div key={id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              {editing ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
                    <input className={fieldClass} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Board tags</label>
                    <input className={fieldClass} value={editTags} onChange={(e) => setEditTags(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="success" icon={CheckIcon} onClick={saveEdit} disabled={updateMut.isPending} />
                    <Button variant="discrete" icon={XMarkIcon} onClick={() => setEditId(null)} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(c.routeToBoardTags || []).length === 0 ? (
                        <span className="text-xs text-gray-400">Routes to all boards</span>
                      ) : (
                        (c.routeToBoardTags || []).map((t) => (
                          <Badge key={t} color="light">
                            {t}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="discrete" icon={ChevronUpIcon} onClick={() => move(i, -1)} disabled={i === 0 || reorderMut.isPending} />
                    <Button variant="discrete" icon={ChevronDownIcon} onClick={() => move(i, 1)} disabled={i === categories.length - 1 || reorderMut.isPending} />
                    <Button variant="discrete" icon={PencilSquareIcon} onClick={() => startEdit(c)} />
                    <Button variant="light_danger" icon={TrashIcon} onClick={() => remove(c)} disabled={deleteMut.isPending} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="discrete" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
