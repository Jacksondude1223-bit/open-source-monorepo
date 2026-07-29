export default function TextLabel({
  label = '',
  icon,
  type = 'text',
  id = '',
  placeholder = '',
  required = true,
  className = '',
  defaultValue = '',
  value,
  min = '',
  max = '',
  labelClassName = '',
  disableMt = false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onBlur = () => { },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange = () => { },
  disableWFull = false,
}: {
  label?: string;
  icon?: any;
  type?: string | 'text' | 'color' | 'date' | 'file' | 'number' | 'range' | 'reset' | 'tel' | 'time' | 'url' | 'week' | 'datetime-local';
  id?: string;
  placeholder?: string | number;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  defaultValue?: string | number;
  value?: string;
  onBlur?: (a: string) => void;
  onChange?: (a: string) => void;
  min?: string;
  max?: string;
  disableMt?: boolean;
  disableWFull?: boolean;
}) {
  const Icon = icon;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 transition dark:text-gray-300">
          {label}
        </label>
      )}
      <div className={`relative ${!disableMt ? 'mt-1' : ''} rounded-md shadow-xs ${className}`}>
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
        )}
        <input
          onBlur={(v) => {
            onBlur(v.target.value);
          }}
          onChange={(v) => {
            onChange(v.target.value);
          }}
          type={type}
          name={id}
          id={id}
          className={`${labelClassName} block ${disableWFull == false && 'w-full'} rounded-md border-gray-300 ${icon && 'pl-10'
            } focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 py-2 px-2 focus:ring-blue-500 dark:text-gray-200 transition dark:placeholder:text-gray-400 sm:text-sm ${className}`}
          placeholder={placeholder as string}
          required={required}
          defaultValue={defaultValue}
          min={min}
          max={max}
          value={value}
        />
      </div>
    </div>
  );
}
