/* eslint-disable @next/next/no-img-element */
import { FormEvent, useState } from 'react';
import { PaperClipIcon } from '@heroicons/react/20/solid';
import Button from './Button';
import { useUser } from '~/components/contexts/user';

export default function CommentPost({
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  onSubmit = (f) => { },
  children,
}: {
  onSubmit: (f: FormEvent<HTMLFormElement>) => void;
  children?: React.ReactNode;
}) {
  const user = useUser();
  const [files, setFiles] = useState<FileList | null>(null);

  if (!('user' in user)) {
    return <></>;
  }

  return (
    <div className="flex items-start">
      <div className="shrink-0">
        {!user || 'loggedIn' in user || 'loading' in user ? (
          <></>
        ) : (
          <img
            className="inline-block h-10 w-10 rounded-full"
            //src={user?.user?.thumbnail}
            src="/"
            alt="User icon"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <form
          onSubmit={async (f) => {
            f.preventDefault();
            onSubmit(f);
          }}
          className="relative"
        >
          <div className="px-2 py-2 overflow-hidden rounded-lg shadow-xs ring ring-inset transition dark:bg-gray-800 ring-gray-300 dark:ring-gray-600 focus-within:ring-2 focus-within:ring-blue-600">
            <label htmlFor="comment" className="sr-only">
              Add your comment
            </label>
            <textarea
              rows={3}
              maxLength={500}
              name="comment"
              id="comment"
              className="block w-full resize-none border-0 bg-transparent text-gray-900 transition dark:text-gray-100 dark:placeholder:text-gray-600 placeholder:text-gray-400 focus:ring-0 sm:py-1.5 sm:text-sm sm:leading-6"
              placeholder="Add your comment..."
              defaultValue={''}
            />

            <div className="px-3 text-sm font-light my-1 flex flex-row gap-2 text-gray-500">
              {files !== null && (
                <>
                  {Array.from(files).map((file) => (
                    <p className="font-bold" key={file.name}>{file.name}</p>
                  ))}
                </>
              )}
            </div>
            <div className="py-2" aria-hidden="true">
              <div className="py-px">
                <div className="h-9" />
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex justify-between py-2 pl-3 pr-2">
            <div className="flex items-center space-x-5">
              <div className="flex items-center">
                <button className="-m-2.5 flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition hover:text-gray-500">
                  <PaperClipIcon className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">Attach a file</span>
                  <input
                    onChange={(f) => setFiles(f.target.files)}
                    type="file"
                    id="files"
                    className="absolute w-10 h-full outline-hidden indent-[-999em]"
                    accept="image/png, image/jpeg, .pdf"
                    multiple={true}
                  />
                </button>
              </div>
              {children}
            </div>
            <div className="shrink-0">
              <Button variant="primary" size="medium">
                Post
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
