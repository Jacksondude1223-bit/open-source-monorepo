import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { JSX, useState } from 'react';

export default function TogglableCard({
  title = '',
  children,
  optionalHeaderChildren,
}: {
  title?: string;
  children: React.ReactNode;
  optionalHeaderChildren?: React.ReactNode;
}): JSX.Element {
  const [toggled, setToggled] = useState(true);
  return (
    <div
      className={`w-full overflow-hidden rounded-lg bg-white transition dark:bg-gray-800 dark:border-gray-700 shadow-lg border-2 border-gray-100 px-4 py-4`}
    >
      <div
        className={`flex flex-row justify-between ${toggled && 'pb-2 mb-2 border-b'
          }`}
      >
        <button
          className="flex flex-row gap-2 w-full"
          type="button"
          onClick={() => {
            setToggled(!toggled);
          }}
        >
          {toggled ? (
            <ChevronDownIcon className="w-6 h-6 font-bold text-gray-900 transition dark:text-gray-100 self-center align-middle" />
          ) : (
            <ChevronRightIcon className="w-6 h-6 font-bold text-gray-900 transition dark:text-gray-100 self-center align-middle" />
          )}
          <h2 className="font-bold text-lg">{title}</h2>
        </button>
        {optionalHeaderChildren}
      </div>
      <div>{toggled && children}</div>
    </div>
  );
}
