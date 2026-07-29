import { JSX, useEffect, useState } from 'react';
import { Description, Field, Label, Switch } from '@headlessui/react';
import classNames from '~/utils/classNames';
import Header from '../NextGenStyles/Header';
import { useWorkspace } from '../contexts/workspace';

export default function Toggle({
  id,
  title,
  titleClass = '',
  description,
  className = '',
  value = false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange = () => { },
}: {
  id?: string;
  titleClass?: string;
  title?: string;
  description?: string;
  className?: string;
  value?: boolean;
  onChange?: (v: boolean) => void;
}): JSX.Element {
  const [enabled, setEnabled] = useState(value);
  const workspace = useWorkspace();
  const brandColor = workspace?.brandColor || 'blue';

  useEffect(() => {
    setEnabled(value);
  }, [value]);

  return (
    <Field
      as="div"
      className={`flex ${className.includes('justify-') ? '' : 'justify-between gap-2 items-center'
        } ${className}`}
    >
      {title && (
        <span className="flex grow flex-col">
          <Label
            as="span"
            className={`text-sm ${titleClass}`}
            passive
          >
            <Header fontSize="sm">{title}</Header>
          </Label>
          <Description as="span" className="text-sm text-gray-500 align-middle mt-1">
            {description}
          </Description>
        </span>
      )}
      <Switch
        checked={enabled}
        onChange={(v) => {
          setEnabled(v);
          onChange(v);
        }}
        className={classNames(
          enabled ? `bg-${brandColor}-600` : 'bg-gray-200 transition dark:bg-gray-700',
          `self-center align-middle mt-1 relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-${brandColor}-500 focus:ring-offset-2`,
        )}
      >
        <span
          aria-hidden="true"
          className={classNames(
            enabled ? 'translate-x-5' : 'translate-x-0',
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-100 shadow-sm ring-0 transition duration-200 ease-in-out',
          )}
        />
        <input
          className="hidden"
          type="checkbox"
          checked={enabled}
          id={id}
          onChange={(val) => {
            setEnabled(val.target.checked);
            onChange(val.target.checked);
          }}
        />
      </Switch>
    </Field>
  );
}
