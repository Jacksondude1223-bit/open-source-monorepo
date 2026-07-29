'use client';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
} from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid';
import { JSX, useEffect, useState } from 'react';

export type DropdownChoiceType = {
  name: string;
  id: string;
}[];

export default function MultiSelectDropdown({
  label = '',
  choices = [],
  id = '',
  placeholder = '',
  onSelectChoice = () => { },
  defaultValue = [],
  value,
  className = '',
  onChange,
}: {
  label?: string;
  choices: DropdownChoiceType;
  id?: string;
  required?: boolean;
  defaultValue?: string[];
  placeholder?: string;
  className?: string;
  onSelectChoice?: any;
  onChange?: any;
  value?: string[];
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [changed, setChanged] = useState<boolean>(false);
  const [selectedChoices, setSelectedChoices] = useState<string[]>(value || defaultValue || []);

  useEffect(() => {
    if (changed) {
      return;
    }
    if (value !== undefined) {
      if (JSON.stringify(selectedChoices) !== JSON.stringify(value)) {
        setSelectedChoices(value);
      }
    } else if (defaultValue) {
      if (JSON.stringify(selectedChoices) !== JSON.stringify(defaultValue)) {
        setSelectedChoices(defaultValue);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, defaultValue, selectedChoices]);


  const filteredChoices =
    query === ''
      ? choices
      : choices.filter((choice) =>
        choice.name.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelectionChange = (selected: string[]) => {
    if (!changed) {
      setChanged(true);
    }
    setSelectedChoices(selected);
    onSelectChoice(selected);
    if (onChange) {
      onChange(selected);
    }
  };

  return (
    <Combobox
      as="div"
      value={selectedChoices}
      onChange={handleSelectionChange}
      id={id}
      multiple={true}
    >
      {label && (
        <Label className="block text-sm font-medium leading-6 text-gray-900 transition dark:text-gray-500">
          {label}
        </Label>
      )}
      <div className={`relative ${label ? 'mt-2' : ''}`}>
        <ComboboxInput
          className={`${className} w-full z-50 rounded-md border-0 bg-white transition dark:bg-gray-800 dark:text-gray-100 py-1.5 pl-3 pr-10 text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6`}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          displayValue={(selectedChoices: string[]) =>
            selectedChoices.map((id) => choices.find((c) => c.id === id)?.name).join(', ')
          }
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-hidden">
          <ChevronUpDownIcon
            className="h-5 w-5 text-gray-400 transition dark:text-gray-600"
            aria-hidden="true"
          />
        </ComboboxButton>

        {filteredChoices.length > 0 && (
          <ComboboxOptions
            anchor="bottom start"
            className="z-50 w-(--input-width) max-h-[min(15rem,var(--anchor-max-height,15rem))] overflow-auto rounded-md bg-white transition bg-linear-to-br dark:from-gray-800 dark:to-slate-800 dark:ring-gray-500 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-hidden sm:text-sm [--anchor-gap:4px]"
          >
            {filteredChoices.map((choice) => (
              <ComboboxOption
                key={choice.id}
                value={choice.id}
                className="relative cursor-default select-none py-2 pl-8 pr-4 text-gray-900 transition dark:text-gray-200 data-focus:bg-blue-600 data-focus:text-white data-selected:font-semibold data-selected:text-white"
              >
                {({ selected, active }) => (
                  <>
                    <span className="block truncate">{choice.name}</span>
                    {selected && (
                      <span
                        className={`absolute inset-y-0 left-0 items-center pl-1.5 ${active ? 'text-white' : 'text-blue-600'
                          } self-center`}
                      >
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            ))}
          </ComboboxOptions>
        )}
      </div>
    </Combobox>
  );
}
