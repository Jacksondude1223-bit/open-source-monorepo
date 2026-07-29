'use client'

import { useState } from 'react'
import { Radio, RadioGroup } from '@headlessui/react'
import classNames from '~/utils/classNames';

export default function RadioDescriptionPanel({ label, options, id }: { label: string, options: { id: string, name: string, description: string }[], id?: string }) {
    const [selected, setSelected] = useState(options[0])

    return (
        <fieldset aria-label={label}>
            <input type="hidden" name={id} id={id} value={selected?.id} />
            <RadioGroup value={selected} onChange={setSelected} className="-space-y-px rounded-md bg-white dark:bg-gray-800">
                {options.map((setting, settingIdx) => (
                    <Radio
                        key={setting.name}
                        value={setting}
                        aria-label={setting.name}
                        className={classNames(
                            settingIdx === 0 ? 'rounded-tl-md rounded-tr-md' : '',
                            settingIdx === options.length - 1 ? 'rounded-bl-md rounded-br-md' : '',
                            'group relative flex cursor-pointer border border-gray-200 dark:border-gray-700 p-4 focus:outline-hidden data-checked:z-10 data-checked:border-blue-200 data-checked:bg-blue-50 dark:data-checked:border-blue-800 dark:data-checked:bg-blue-900/30',
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className="mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 group-data-checked:border-transparent group-data-checked:bg-blue-600 group-data-focus:ring-2 group-data-focus:ring-blue-600 group-data-focus:ring-offset-2 dark:group-data-focus:ring-offset-gray-800"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-blue-600" />
                        </span>
                        <span className="ml-3 flex flex-col">
                            <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 group-data-checked:text-blue-900 dark:group-data-checked:text-blue-200">
                                {setting.name}
                            </span>
                            <span className="block text-sm text-gray-500 dark:text-gray-400 group-data-checked:text-blue-700 dark:group-data-checked:text-blue-300">
                                {setting.description}
                            </span>
                        </span>
                    </Radio>
                ))}
            </RadioGroup>
        </fieldset>
    )
}
