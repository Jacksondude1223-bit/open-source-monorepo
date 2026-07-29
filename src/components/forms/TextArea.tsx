import { JSX, SVGProps } from 'react';

export default function TextArea({
  label = '',
  icon,
  id = '',
  placeholder = '',
  required = true,
  className = '',
  defaultValue = '',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onBlur = () => { },
  rows = 1,
}: {
  label?: string;
  icon?: JSX.Element;
  type?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
  onBlur?: (v: string) => void;
  rows?: number;
}) {
  const Icon = icon as any;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 transition dark:text-gray-500">
          {label}
        </label>
      )}
      <div className={`relative mt-1 rounded-md shadow-xs ${className}`}>
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
        )}
        <textarea
          onBlur={(v) => {
            onBlur(v.target.value);
          }}
          name={id}
          id={id}
          className={`block w-full rounded-md border-gray-300 transition dark:bg-gray-800 transition dark:placeholder:text-gray-500 transition dark:border-gray-600 transition dark:text-gray-100 ${icon && 'pl-10'
            } focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${className}`}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
          rows={rows}
        />
      </div>
    </div>
  );
}
