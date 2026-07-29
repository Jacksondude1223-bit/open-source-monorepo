import { JSX, useState } from 'react';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { createTheme, ThemeProvider } from '@mui/material';
import { Moment } from 'moment';
import { DateRange } from '@mui/x-date-pickers-pro/models';
import { useUser } from '../contexts/user';

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
  const [value, setValue] = useState<DateRange<Moment>>([null, null]);
  const darkMode = 'user' in user ? user?.user?.dbUser?.darkMode == true || false : false;
  const theme = darkMode ? 'dark' : 'light';
  console.log(theme)
  return (
    <div className='mt-2'>
      <input type="text" className='hidden' id={`startdate`} value={value[0]?.toISOString() || ''} />
      <input type="text" className='hidden' id={`enddate`} value={value[1]?.toISOString() || ''} />

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
        <DateRangePicker value={value} className='w-full' onChange={setValue} localeText={{ start: startLabel || 'Start Day', end: endLabel || 'End Day' }} />
      </ThemeProvider>

    </div>
  );
}
