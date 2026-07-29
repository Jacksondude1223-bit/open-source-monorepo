import { useState } from 'react';
import { Description, Label, RadioGroup, RadioGroupOption } from '@headlessui/react';
import { CheckCircleIcon } from '@heroicons/react/20/solid';
import classNames from '~/utils/classNames';
import Link from 'next/link';
import { useWorkspace } from '~/components/contexts/workspace';

export default function Radio({
  options = [],
  label = '',
  defaultValue,
  id = '',
  className = '',
}: {
  options: {
    id: string;
    title: string;
    description: string;
    subDescription: string;
    lockedToPremium?: boolean;
  }[];
  label: string;
  id?: string;
  defaultValue?: string;
  className?: string;
}) {
  const workspace = useWorkspace();
  const [selected, setSelected] = useState(
    options.find((a) => a.id == defaultValue || '') ?? options[0],
  );

  return (
    <>
      <input type="string" className="hidden" id={id} value={selected?.id} />
      <RadioGroup
        defaultValue={selected}
        value={selected}
        onChange={setSelected}
        className={className}
      >
        <Label className="text-base font-semibold leading-6 text-gray-900">
          {label}
        </Label>
        <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-4 sm:gap-x-4">
          {options.map((option) => (
            <RadioGroupOption
              key={option.id}
              value={option}
              disabled={
                (option.lockedToPremium && !workspace?.premium?.is) || false
              }
              className={({ checked, active }) =>
                classNames(
                  checked ? 'border-transparent' : 'border-gray-300',
                  active ? 'border-blue-600 ring-2 ring-blue-600' : '',
                  'relative flex cursor-pointer rounded-lg border bg-white transition dark:bg-gray-800 p-4 shadow-xs focus:outline-hidden',
                )
              }
            >
              {({ active }) => (
                <div>
                  {option.lockedToPremium && !workspace?.premium?.is && (
                    <div className="absolute w-full h-full opacity-90 bg-red-100 dark:bg-red-950 rounded-lg -mt-4 -ml-4 flex flex-col">
                      <div className="flex h-full flex-col justify-center text-center self-center align-middle">
                        <p className="font-bold text-center text-gray-900 transition dark:text-gray-100">
                          This is a premium feature
                        </p>
                        <Link
                          className="font-bold text-center text-blue-500 transition hover:text-blue-900"
                          href={`/workspaces/${workspace.groupId}/settings/billing`}
                        >
                          Subscribe to premium
                        </Link>
                      </div>
                    </div>
                  )}
                  <span className="flex flex-1">
                    <span className="flex flex-col">
                      <Label
                        as="span"
                        className="block text-sm font-medium text-gray-900 transition dark:text-gray-100 z-20"
                      >
                        {option.title}
                      </Label>
                      <Description
                        as="span"
                        className="mt-1 flex items-center text-sm text-gray-500"
                      >
                        {option.description}
                      </Description>
                    </span>
                  </span>
                  <div className="flex flex-row mt-6 gap-2 justify-between">
                    <Description
                      as="span"
                      className="text-sm font-medium text-gray-900 transition dark:text-gray-100"
                    >
                      {option.subDescription}
                    </Description>
                    <CheckCircleIcon
                      className={classNames(
                        //@ts-expect-error it takes perusasion
                        !(selected.id == option.id) ? 'hidden' : '',
                        'h-5 w-5 text-blue-600',
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <span
                    className={classNames(
                      active ? 'border' : 'border-2',
                      //@ts-expect-error it takes perusasion
                      selected.id == option.id
                        ? 'border-blue-600'
                        : 'border-transparent',
                      'pointer-events-none absolute -inset-px rounded-lg',
                    )}
                    aria-hidden="true"
                  />
                </div>
              )}
            </RadioGroupOption>
          ))}
        </div>
      </RadioGroup>
    </>
  );
}
