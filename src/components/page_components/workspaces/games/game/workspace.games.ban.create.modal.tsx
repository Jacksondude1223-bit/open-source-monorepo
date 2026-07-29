import { trpc } from '~/utils/trpc';
import Button from '~/components/forms/Button';
import TextLabel from '~/components/forms/TextLabel';
import PageHeading from '~/components/layouts/PageHeading';
import DatePicker from '~/components/ui/DatePicker';
import Modal from '~/components/ui/Modal';
import RobloxUserSearch from '~/components/ui/RobloxUserSearch';
import { PropsWithChildren, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import toast from 'react-hot-toast';
import ReadFile from '~/utils/FileReader';
import { PaperClipIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function WorkspacGameBanUserModal({
  open,
  setOpen,
  groupId,
}: PropsWithChildren<{
  open: boolean;
  setOpen: any;
  groupId: string;
}>) {
  const mutation = trpc.workspaces.workspace.games.bans.createBan.useMutation();
  const context = trpc.useUtils();

  const [files, setFiles] = useState<File[]>([]);

  const isImage = (file: File) => file.type.startsWith('image/');

  return (
    <Modal open={open} setOpen={setOpen}>
      <PageHeading title="Ban User" />
      <form
        className="flex flex-col gap-3"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const {
            userId: { value: userId },
            reason: { value: reason },
            expires: { value: expires },
          } = target;

          const fileData: [string, string][] = [];
          for (const file of files) {
            const base64 = (await ReadFile(file)) as string;
            fileData.push([file.name, base64]);
          }

          mutation
            .mutateAsync({
              groupId,
              userId,
              reason,
              ...(expires !== '' ? { expires: new Date(expires) } : {}),
              ...(fileData.length > 0 ? { files: fileData } : {}),
            })
            .then(() => {
              toast.success('Successfully banned user');
              context.workspaces.workspace.games.bans.getBans.invalidate({ groupId });
              setFiles([]);
              setOpen(false);
            })
            .catch((e) => {
              toast.error(e.message);
            });
        }}
      >
        {mutation.isPending ? (
          <LoadingPage />
        ) : (
          <>
            <RobloxUserSearch id="userId" placeholder={'Type a username'} />
            <TextLabel required={true} id="reason" label="Reason" />
            <DatePicker label="Expiry date" id="expires" />
            <p className="-mt-1 text-sm font-medium text-gray-500">
              Leave blank to permanently ban user.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Evidence
              </label>
              <label
                htmlFor="ban-evidence"
                className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center transition hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-800"
              >
                <PhotoIcon className="size-6 text-gray-400" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Click to upload images or files
                </span>
                <span className="text-xs text-gray-400">
                  Screenshots, logs or other proof of the offence
                </span>
                <input
                  id="ban-evidence"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    if (selected.length > 0) {
                      setFiles((prev) => [...prev, ...selected]);
                    }
                    e.target.value = '';
                  }}
                />
              </label>

              {files.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {files.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {isImage(file) ? (
                          <PhotoIcon className="size-4 shrink-0 text-gray-400" />
                        ) : (
                          <PaperClipIcon className="size-4 shrink-0 text-gray-400" />
                        )}
                        <span className="truncate text-sm text-gray-700 dark:text-gray-200">
                          {file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="shrink-0 rounded p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      >
                        <XMarkIcon className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button className="mt-1" variant="danger" size="medium">
              Ban User
            </Button>
          </>
        )}
      </form>
    </Modal>
  );
}
