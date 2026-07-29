import { Switch } from '@headlessui/react';
import classNames from '~/utils/classNames';

export default function MagicToggleForAbsoloute({
  label = '',
  value = false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  onChange = (v: boolean) => { },
  id,
  className = '',
  disabled
}: {
  className?: string;
  id?: string;
  label?: string;
  value?: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className={`${className} flex flex-row ${label && 'gap-2'}`}>
      {label && <p className="text-md self-center w-full">{label}</p>}
      <input type="checkbox" checked={value} id={id} className="hidden" onChange={() => { }} />
      <Switch
        disabled={disabled}
        checked={value}
        onChange={(v: boolean) => {
          onChange(v);
        }}
        className={classNames(
          value ? 'bg-blue-600' : 'bg-gray-200',
          `self-center relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`,
        )}
      >
        <span className="sr-only">Use setting</span>
        <span
          aria-hidden="true"
          className={classNames(
            value ? 'translate-x-5' : 'translate-x-0',
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
          )}
        />
      </Switch>
    </div>
  );
}
