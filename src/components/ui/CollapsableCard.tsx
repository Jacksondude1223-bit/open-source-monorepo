import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { PropsWithChildren, useState } from 'react';

export default function CollapsableCard({
  children,
  title,
}: PropsWithChildren<{
  title: string;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg border-gray-200 transition dark:border-gray-700 transition dark:bg-gray-800 px-2 py-2 flex flex-col gap-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-row justify-between"
      >
        <p className="font-bold text-md">{title}</p>
        <div className="flex flex-row gap-2">
          <div>
            {open ? (
              <ChevronRightIcon className="w-6 h-6" />
            ) : (
              <ChevronDownIcon className="w-6 h-6" />
            )}
          </div>
        </div>
      </button>
      {open && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  );
}
