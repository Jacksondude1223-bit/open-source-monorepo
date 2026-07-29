import { useState } from 'react';
import * as DPicker from '@mui/x-date-pickers/DatePicker';
import { PickerValidDate } from '@mui/x-date-pickers/models';

export default function DatePicker({
  id,
  label = '',
  placeholder = 'Select date',
  required = false,
  defaultValue,
  onChange,
}: {
  required?: boolean;
  id: string;
  name?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: any;
  onChange?: (date: string) => void;
}) {
  const [value, setValue] = useState<PickerValidDate | null>(defaultValue || null);

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 transition dark:text-gray-500"
        >
          {label}
        </label>
      )}
      <div className="relative mt-1 rounded-md shadow-xs">
        <input className="hidden" required={required} id={id} value={value?.toISOString() || ''} readOnly />
        <DPicker.DatePicker
          value={value}
          onChange={(val) => {
            setValue(val);
            if (onChange) {
              onChange(val?.toISOString() || '');
            }
          }}
          slotProps={{
            textField: {
              fullWidth: true,
              placeholder,
              sx: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  backgroundColor: 'transparent',
                  color: 'inherit',
                  '& fieldset': {
                    borderColor: 'rgb(209 213 219)',
                    transition: 'border-color 150ms ease, box-shadow 150ms ease',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgb(209 213 219)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'rgb(59 130 246)',
                    borderWidth: '1px',
                    boxShadow: '0 0 0 1px rgb(59 130 246)',
                  },
                  '.dark &': {
                    backgroundColor: 'rgb(31 41 55)',
                    color: 'rgb(243 244 246)',
                    '& fieldset': {
                      borderColor: 'rgb(75 85 99)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgb(75 85 99)',
                    },
                  },
                },
                '& .MuiInputBase-input': {
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                },
                '& .MuiSvgIcon-root': {
                  color: 'rgb(107 114 128)',
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
