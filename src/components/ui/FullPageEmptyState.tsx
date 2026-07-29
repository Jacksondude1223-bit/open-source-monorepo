import { PlusIcon } from '@heroicons/react/20/solid';
import { JSX } from 'react';

export default function FullPageEmptyState({
  icon,
  title,
  description,
  buttonText,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  cbFunction = () => { },
}: {
  icon: any;
  title: string;
  description: string;
  buttonText: string;
  cbFunction?: (response: true) => void;
}): JSX.Element {
  const Icon = icon;

  return (
    <div className="text-center mt-12">
      <Icon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      <div className="mt-6">
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={() => {
            cbFunction(true);
          }}
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          {buttonText}
        </button>
      </div>
    </div>
  );
}
