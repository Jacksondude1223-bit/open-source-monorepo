/* eslint-disable @next/next/no-img-element */
import { Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid';
import { JSX, useEffect, useState } from 'react';
import { useWorkspace } from '../contexts/workspace';

export type DropdownChoiceType = {
  name: string;
  id: string;
  image?: string;
}[];

export default function Dropdown({
  label = '',
  choices = [],
  id = '',
  required = true,
  defaultValue = '',
  className = '',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange = () => { },
  buttonClassName = '',
  placeholder = ''
}: {
  label?: string;
  choices: DropdownChoiceType;
  id?: string;
  required?: boolean;
  defaultValue?: string | number;
  className?: string;
  onChange?: (e: any) => void;
  multiple?: boolean;
  disableWFull?: boolean;
  buttonClassName?: string;
  placeholder?: string;
}): JSX.Element {
  const workspace = useWorkspace();
  const brandColor = workspace?.brandColor || 'blue';

  const [userSelected, setUserSelected] = useState<any>(choices?.find(choice => choice?.id == defaultValue) || choices[0]);
  const [selected, setSelected] = useState(choices?.find(choice => choice?.id == defaultValue) || choices[0]);

  useEffect(() => {
    setSelected(choices?.find(c => c?.id == userSelected?.id && c?.name == userSelected?.name) ? userSelected : choices.find(choice => choice.id == defaultValue) || choices[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, defaultValue]);

  return (
    <>
      <input type="string" required={required} className="hidden" id={id} value={selected?.id} onChange={() => { }} />
      <Listbox
        key={id || label || JSON.stringify(choices.map(c => c.id))}
        defaultValue={choices.find(a => a.id == defaultValue)}
        value={selected}
        onChange={(selected) => {
          setSelected(selected);
          onChange(selected.id);
          setUserSelected(selected);
        }}
      >
        {label && (<Label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-100">{label}</Label>)}
        <div className={`relative ${className}`}>
          <ListboxButton className={`${buttonClassName} relative w-full cursor-default rounded-md bg-white dark:bg-gray-800 dark:text-gray-100 py-1.5 pl-3 pr-10 text-left text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:outline-hidden focus:ring-2 focus:ring-${brandColor}-500 sm:text-sm sm:leading-6`}>
            <span className="flex items-center">
              {selected?.image && (<img alt="" src={selected.image} className="h-5 w-5 shrink-0 rounded-full" />)}
              <span className="ml-3 block truncate">{selected?.name || placeholder}</span>
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 ml-3 flex items-center pr-2">
              <ChevronUpDownIcon aria-hidden="true" className="h-5 w-5 text-gray-400" />
            </span>
          </ListboxButton>

          <ListboxOptions
            anchor="bottom start"
            className="z-50 w-(--button-width) max-h-[min(14rem,var(--anchor-max-height))] overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-hidden data-closed:data-leave:opacity-0 data-leave:transition data-leave:duration-100 data-leave:ease-in sm:text-sm [--anchor-gap:4px]"
          >
            {choices.map((choice) => (
              <ListboxOption
                key={choice.id}
                value={choice}
                className={`group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 dark:text-gray-100 data-focus:bg-${brandColor}-600 data-focus:text-white`}
              >
                {({ selected }) => (
                  <>
                    <div className="flex items-center">
                      {choice?.image && (<img alt="" src={choice?.image} className="h-5 w-5 shrink-0 rounded-full" />)}
                      <span className="ml-2 block truncate font-normal group-data-selected:font-semibold">
                        {choice.name}
                      </span>
                    </div>

                    <span className={`absolute inset-y-0 right-0 items-center pr-4 text-${brandColor}-600 group-data-focus:text-white ${selected ? 'flex' : 'hidden'}`}>
                      <CheckIcon aria-hidden="true" className="h-5 w-5" />
                    </span>
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      </Listbox>
    </>
  )
}
