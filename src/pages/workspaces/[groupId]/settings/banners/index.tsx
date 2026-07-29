/* eslint-disable @next/next/no-img-element */
import { ReactElement, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/solid';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import TextLabel from '~/components/forms/TextLabel';
import Dropdown from '~/components/forms/Dropdown';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';
import ReadFile from '~/utils/FileReader';
import { Alert } from '~/components/page_components/alerts';

type BannerType = 'primary' | 'warning' | 'danger';

type EditorState = {
  id?: string; // present when editing an existing banner
  type: BannerType;
  title: string;
  message: string;
  link: string;
  linkMessage: string;
  closable: boolean;
  enabled: boolean;
  restrictDepartments: boolean;
  departmentIds: string[];
  imageUrl?: string; // CDN object key (persisted)
  imagePreview?: string; // presigned/temporary preview URL
};

const TYPE_CHOICES = [
  { id: 'primary', name: 'Information (blue)' },
  { id: 'warning', name: 'Warning (yellow)' },
  { id: 'danger', name: 'Danger (red)' },
];

const emptyEditor: EditorState = {
  type: 'primary',
  title: '',
  message: '',
  link: '',
  linkMessage: '',
  closable: true,
  enabled: true,
  restrictDepartments: false,
  departmentIds: [],
};

export default function BannersSettingsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const context = trpc.useUtils();

  const { data, isPending } = trpc.workspaces.workspace.settings.banners.list.useQuery(
    { groupId },
    { enabled: !!groupId && workspace?.department?.permissions?.admin === true },
  );

  const createMutation = trpc.workspaces.workspace.settings.banners.create.useMutation();
  const updateMutation = trpc.workspaces.workspace.settings.banners.update.useMutation();
  const deleteMutation = trpc.workspaces.workspace.settings.banners.delete.useMutation();
  const uploadMutation = trpc.workspaces.workspace.settings.banners.uploadImage.useMutation();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = () => {
    context.workspaces.workspace.settings.banners.list.invalidate({ groupId });
    context.workspaces.workspace.settings.banners.getActiveBanners.invalidate({ groupId });
  };

  if (!workspace) return <LoadingPage />;

  if (!workspace.department.permissions.admin) {
    return (
      <>
        <PageHeading title="Banners" disableDivide />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Admins only</p>
          <Small>You must be a workspace admin to manage banners.</Small>
        </div>
      </>
    );
  }

  if (isPending) return <LoadingPage />;

  const departments = data?.departments ?? [];
  const banners = data?.banners ?? [];

  const startNew = () => setEditor({ ...emptyEditor });

  const startEdit = (id: string) => {
    const b = banners.find((x) => x.id === id);
    if (!b) return;
    const restricted = (b.departmentIds ?? []).length > 0;
    setEditor({
      id: b.id,
      type: b.type,
      title: b.title ?? '',
      message: b.message,
      link: b.link ?? '',
      linkMessage: b.linkMessage ?? '',
      closable: b.closable === true,
      enabled: b.enabled,
      restrictDepartments: restricted,
      departmentIds: b.departmentIds ?? [],
      imageUrl: b.imageObjectKey, // raw CDN key, preserved on save
      imagePreview: b.imageUrl, // presigned preview URL
    });
  };

  const toggleDepartment = (id: string) => {
    if (!editor) return;
    setEditor({
      ...editor,
      departmentIds: editor.departmentIds.includes(id)
        ? editor.departmentIds.filter((d) => d !== id)
        : [...editor.departmentIds, id],
    });
  };

  const handleUpload = async () => {
    if (!editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as any).files?.[0];
      if (!file) return;
      try {
        setUploading(true);
        const fileData = await ReadFile(file);
        const result = await uploadMutation.mutateAsync({
          groupId,
          name: file.name,
          data: fileData?.toString() as string,
        });
        setEditor((prev) =>
          prev ? { ...prev, imageUrl: result.filePath, imagePreview: result.url } : prev,
        );
        toast.success('Image uploaded.');
      } catch (err: any) {
        toast.error(err?.message || 'Failed to upload image.');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const save = () => {
    if (!editor) return;
    if (!editor.message.trim()) {
      toast.error('Banner message is required.');
      return;
    }
    if (editor.link.trim() && !editor.linkMessage.trim()) {
      toast.error('Add a label for your link, or remove the link.');
      return;
    }
    if (
      editor.restrictDepartments &&
      editor.departmentIds.length === 0
    ) {
      toast.error('Select at least one department, or turn off the department limit.');
      return;
    }

    const payload = {
      type: editor.type,
      title: editor.title.trim() || undefined,
      message: editor.message.trim(),
      link: editor.link.trim() || undefined,
      linkMessage: editor.linkMessage.trim() || undefined,
      closable: editor.closable,
      enabled: editor.enabled,
      departmentIds: editor.restrictDepartments ? editor.departmentIds : [],
      imageUrl: editor.imageUrl || undefined,
    };

    const promise = editor.id
      ? updateMutation.mutateAsync({ groupId, id: editor.id, banner: payload })
      : createMutation.mutateAsync({ groupId, banner: payload });

    toast
      .promise(promise, {
        loading: 'Saving…',
        success: editor.id ? 'Banner updated.' : 'Banner created.',
        error: (err) => err?.message || 'Failed to save banner.',
      })
      .then(() => {
        setEditor(null);
        refresh();
      });
  };

  const remove = (id: string) => {
    if (!window.confirm('Delete this banner? This cannot be undone.')) return;
    toast
      .promise(deleteMutation.mutateAsync({ groupId, id }), {
        loading: 'Deleting…',
        success: 'Banner deleted.',
        error: (err) => err?.message || 'Failed to delete banner.',
      })
      .then(() => {
        if (editor?.id === id) setEditor(null);
        refresh();
      });
  };

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Banners`}
        description="Show an announcement banner to your staff, optionally limited to certain departments"
      />

      <div className="mt-4 flex flex-col gap-4">
        {!editor && (
          <div className="flex flex-row justify-end">
            <Button variant="primary" size="medium" onClick={startNew}>
              <span className="flex flex-row items-center gap-2">
                <PlusIcon className="h-4 w-4" /> New Banner
              </span>
            </Button>
          </div>
        )}

        {editor && (
          <Card className="flex flex-col gap-4">
            <Header fontSize="sm">{editor.id ? 'Edit banner' : 'New banner'}</Header>

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Style
              </label>
              <Dropdown
                id="bannerType"
                required={false}
                choices={TYPE_CHOICES}
                defaultValue={editor.type}
                onChange={(id: any) => setEditor({ ...editor, type: id as BannerType })}
              />
            </div>

            <TextLabel
              label="Title (optional)"
              id="bannerTitle"
              required={false}
              value={editor.title}
              onChange={(v) => setEditor({ ...editor, title: v })}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Message
              </label>
              <textarea
                className="block w-full rounded-md border-gray-300 transition dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                rows={3}
                value={editor.message}
                onChange={(e) => setEditor({ ...editor, message: e.target.value })}
                placeholder="What do you want your staff to know?"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextLabel
                label="Link URL (optional)"
                id="bannerLink"
                type="url"
                required={false}
                placeholder="https://…"
                value={editor.link}
                onChange={(v) => setEditor({ ...editor, link: v })}
              />
              <TextLabel
                label="Link label"
                id="bannerLinkMessage"
                required={false}
                placeholder="Learn more"
                value={editor.linkMessage}
                onChange={(v) => setEditor({ ...editor, linkMessage: v })}
              />
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700/60 pt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Image (optional)
              </label>
              {editor.imagePreview && (
                <div className="mb-3 inline-block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img className="max-h-32 object-cover" src={editor.imagePreview} alt="Banner attachment" />
                </div>
              )}
              <div className="flex flex-row gap-3">
                <Button type="button" variant="discrete" size="small" onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Uploading…' : editor.imagePreview ? 'Replace Image' : 'Upload Image'}
                </Button>
                {editor.imagePreview && (
                  <Button
                    type="button"
                    variant="light_danger"
                    size="small"
                    onClick={() => setEditor({ ...editor, imageUrl: undefined, imagePreview: undefined })}
                  >
                    Remove Image
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700/60 pt-3 flex flex-col gap-4">
              <Toggle
                id="bannerEnabled"
                title="Enabled"
                description="Turn off to hide this banner without deleting it."
                value={editor.enabled}
                onChange={(v) => setEditor({ ...editor, enabled: v })}
              />
              <Toggle
                id="bannerClosable"
                title="Allow dismiss"
                description="Let staff close the banner so it stops showing for them."
                value={editor.closable}
                onChange={(v) => setEditor({ ...editor, closable: v })}
              />
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700/60 pt-3 flex flex-col gap-4">
              <Toggle
                id="bannerRestrict"
                title="Limit to specific departments"
                description="By default every department sees the banner. Turn this on to choose which departments it shows to."
                value={editor.restrictDepartments}
                onChange={(v) => setEditor({ ...editor, restrictDepartments: v })}
              />
              {editor.restrictDepartments && (
                <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
                  {departments.length === 0 ? (
                    <Small>No departments found.</Small>
                  ) : (
                    departments.map((dept) => (
                      <label
                        key={dept._id}
                        className="flex flex-row items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-200"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={editor.departmentIds.includes(dept._id)}
                          onChange={() => toggleDepartment(dept._id)}
                        />
                        <span>
                          {dept.name}
                          {dept.isOwner ? ' (Owner)' : ''}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700/60 pt-3">
              <Small>Preview</Small>
              <div className="mt-2">
                <Alert
                  forceVisible
                  attribution={workspace?.groupName || 'this workspace'}
                  notif={{
                    id: `preview-${editor.id ?? 'new'}`,
                    type: editor.type,
                    title: editor.title || undefined,
                    message: editor.message || 'Your banner message will appear here.',
                    link: editor.link || undefined,
                    linkMessage: editor.linkMessage || undefined,
                    closable: editor.closable,
                    imageUrl: editor.imagePreview,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-row justify-end gap-3">
              <Button variant="discrete" size="medium" onClick={() => setEditor(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" size="medium" onClick={save} disabled={busy}>
                {editor.id ? 'Save Banner' : 'Create Banner'}
              </Button>
            </div>
          </Card>
        )}

        {!editor && (
          <Card className="flex flex-col gap-3">
            <Header fontSize="sm">Your banners</Header>
            {banners.length === 0 ? (
              <Small>No banners yet. Create one to announce something to your staff.</Small>
            ) : (
              banners.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-100 dark:border-gray-700/60 p-3"
                >
                  <div className="flex flex-row items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-row items-center gap-2 flex-wrap">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            b.type === 'primary'
                              ? 'bg-blue-500'
                              : b.type === 'warning'
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                        />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {b.title || b.message.slice(0, 60)}
                        </span>
                        {!b.enabled && (
                          <span className="text-xs rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-gray-600 dark:text-gray-300">
                            Disabled
                          </span>
                        )}
                      </div>
                      <Small>
                        {(b.departmentIds ?? []).length === 0
                          ? 'All departments'
                          : `${b.departmentIds!.length} department${b.departmentIds!.length === 1 ? '' : 's'}`}
                      </Small>
                    </div>
                    <div className="flex flex-row gap-2 shrink-0">
                      <Button type="button" variant="discrete" size="small" onClick={() => startEdit(b.id)}>
                        <span className="flex flex-row items-center gap-1">
                          <PencilSquareIcon className="h-4 w-4" /> Edit
                        </span>
                      </Button>
                      <Button type="button" variant="light_danger" size="small" onClick={() => remove(b.id)}>
                        <span className="flex flex-row items-center gap-1">
                          <TrashIcon className="h-4 w-4" /> Delete
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </Card>
        )}
      </div>
    </>
  );
}

BannersSettingsPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
