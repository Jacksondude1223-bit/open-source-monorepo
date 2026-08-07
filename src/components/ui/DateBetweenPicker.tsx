import { JSX, useState } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { createTheme, ThemeProvider } from '@mui/material';
import { Moment } from 'moment';
import { useUser } from '../contexts/user';

/**
 * A start/end date pair.
 *
 * MUI's `DateRangePicker` — a single calendar that selects both ends — is a paid
 * component, so this is two free `DatePicker`s side by side. The contract is
 * unchanged: consumers still read the ISO strings off the hidden `#startdate`
 * and `#enddate` inputs (see the time-off and records forms).
 */
export default function DateBetweenPicker({
  startLabel,
  endLabel,
  inModal
}: {
  startLabel?: string;
  endLabel?: string;
  inModal?: boolean;
}): JSX.Element {
  const user = useUser();
  const [start, setStart] = useState<Moment | null>(null);
  const [end, setEnd] = useState<Moment | null>(null);
  const darkMode = 'user' in user ? user?.user?.dbUser?.darkMode == true || false : false;
  const theme = darkMode ? 'dark' : 'light';

  // The range picker enforced start <= end for us; two independent pickers do
  // not, so the end picker refuses anything before the chosen start.
  const onStartChange = (value: Moment | null) => {
    setStart(value);
    if (value && end && end.isBefore(value)) {
      setEnd(null);
    }
  };

  return (
    <div className='mt-2'>
      <input type="text" className='hidden' id={`startdate`} value={start?.toISOString() || ''} readOnly />
      <input type="text" className='hidden' id={`enddate`} value={end?.toISOString() || ''} readOnly />

      <ThemeProvider
        defaultMode={theme}
        theme={createTheme({
          palette: {
            mode: theme,
          },
          colorSchemes: {
            dark: darkMode,
          }
        })}>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <DatePicker
            value={start}
            onChange={onStartChange}
            label={startLabel || 'Start Day'}
            className='w-full'
            slotProps={{
              textField: { fullWidth: true },
              // Modals clip the popper, so render the calendar inline there.
              popper: inModal ? { disablePortal: true } : undefined,
            }}
          />
          <DatePicker
            value={end}
            onChange={setEnd}
            label={endLabel || 'End Day'}
            className='w-full'
            minDate={start || undefined}
            slotProps={{
              textField: { fullWidth: true },
              popper: inModal ? { disablePortal: true } : undefined,
            }}
          />
        </div>
      </ThemeProvider>

    </div>
  );
}
