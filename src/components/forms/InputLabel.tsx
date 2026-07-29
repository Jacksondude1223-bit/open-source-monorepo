import { SVGProps } from 'react';

export default function InputLabel({
  label,
  icon,
  type = 'text',
  id = '',
  placeholder = '',
  required = true,
  className = '',
  defaultValue = '',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onBlur = () => { },
}: {
  label: string;
  icon?: any;
  type?: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
  onBlur?: (v: string) => void;
}) {
  const Icon = icon;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 transition"
      >
        {label}
      </label>
      <div className={`relative mt-1 rounded-md shadow-xs ${className}`}>
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
        )}
        <input
          type={type}
          name={id}
          id={id}
          className={`
                    ${type == 'color' && 'px-2 my-2'}
                    block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-400 ${icon && 'pl-10'
            } focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${className}`}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
          onBlur={(v) => {
            onBlur(v.target.value);
          }}
        />
      </div>
    </div>
  );
}
