import { JSX } from "react";

export default function EmptyCardCreateState({
  icon,
  buttonText,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  cbFunction = () => { },
  className = '',
}: {
  icon: any;
  buttonText: string;
  cbFunction?: (response: true) => void;
  className?: string;
}): JSX.Element {
  const Icon = icon;
  return (
    <button
      type="button"
      className={`relative block rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-8 py-2 text-center transition hover:border-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
      onClick={() => {
        cbFunction(true);
      }}
    >
      <Icon className="mx-auto h-8 w-8 text-gray-400 transition dark:text-gray-500" />
      <span className="mt-2 block text-sm font-medium text-gray-900 transition dark:text-gray-100">
        {buttonText}
      </span>
    </button>
  );
}
