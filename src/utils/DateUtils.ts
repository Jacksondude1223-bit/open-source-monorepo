import { format, toZonedTime, fromZonedTime } from 'date-fns-tz';
import moment from 'moment-timezone';

export const ONE_MINUTE = 60;
export const ONE_HOUR = 60 * ONE_MINUTE;
export const ONE_DAY = 24 * ONE_HOUR;
export const ONE_WEEK = 7 * ONE_DAY;

export const Months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DaysInWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export type DaysInWeek_TYPE = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export function addMinutesToDate(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

export function getMinutesAgoDate(minutes: number): Date {
  return new Date(Date.now() - minutes * 60000);
}

export function DateToSeconds(date: Date): number {
  if (!date.getTime) {
    return new Date().getTime() / 1000; // its a fix?
  }
  return date.getTime() / 1000;
}

export function UTCSecondsToDate(number_: number): Date {
  return new Date(number_ * 1000);
}

export function getMonthNumber(d: Date): number {
  return d.getMonth() + 1;
}

/**
 * Returns a zero-padded `MM-DD` key for a date, used to bucket daily summaries
 * within a yearly summary document (heatmap data).
 */
export function getDayKey(date: Date): string {
  const d = new Date(date);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${month}-${day}`;
}

export function getWeekNumber(date: Date): number {
  date = new Date(Number(date));
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const dateMinusYearStart = date.getTime() - yearStart.getTime();
  const weekNo = Math.ceil((dateMinusYearStart / 86_400_000 + 1) / 7);
  return weekNo;
}

export function weeksInYear(year: number): number {
  const d = new Date(year, 11, 31);
  const week = getWeekNumber(d);
  return week == 1 ? 52 : week;
}

export function iso8601ToTimezone(offset: string): string | null {
  // This is an approximation and might not always give the expected result
  const timezones = moment.tz.names();
  const currentTime = moment();
  for (let tz of timezones) {
    if (currentTime.tz(tz).format('Z') === offset) {
      return tz; // Returns the first timezone matching the offset
    }
  }
  return null;
}


/*
This function should always return the first day as Sunday
This function shoul return the dates (starting Sunday) through the week (Sunday to Saturday).
This should work in the users timezone.
*/
export function getWeekDatesStartingSaturday(date: Date): Date[] {
  let week: Date[] = [];

  let startDay = new Date(date);
  startDay.setHours(12, 0, 0, 0);
  let dayOfWeek = startDay.getDay();
  // Adjust to start the week on Sunday
  let offset = dayOfWeek; // If it's Sunday, no adjustment is needed; otherwise, move back to the previous Sunday
  startDay.setDate(startDay.getDate() - offset);

  for (let i = 0; i < 7; i++) {
    let day = new Date(startDay);
    day.setDate(day.getDate() + i);
    week.push(day);
  }

  return week;
}

export function dateToMMDDYYYY(date: Date, tz: string): string {
  return format(toZonedTime(date, tz), 'MM/dd/yyyy', { timeZone: tz });
}

/**
 * Format a date in a specific timezone with locale formatting
 * @param date - The date to format
 * @param tz - The IANA timezone (e.g., 'America/New_York')
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string in the specified timezone
 */
export function formatDateInTimezone(
  date: Date,
  tz: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: tz,
  }).format(date);
}

/**
 * Format a date for display showing full date (e.g., "Thursday, January 01, 2026")
 */
export function formatFullDateInTimezone(date: Date, tz: string): string {
  return formatDateInTimezone(date, tz, {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a time for display (e.g., "2:30 PM")
 */
export function formatTimeInTimezone(date: Date, tz: string): string {
  return formatDateInTimezone(date, tz, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getStartOfDay(date: Date, tz?: string): Date {
  if (tz) {
    const zonedDate = toZonedTime(date, tz);
    zonedDate.setHours(0, 0, 0, 0);
    return fromZonedTime(zonedDate, tz);
  }
  let start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function convert24HRUTCTimeTo24HourTZTime(hour: number, tz: string): number {
  // Create a moment object for the current date at the given hour in UTC
  const utcTime = moment.utc().hour(hour).minute(0).second(0);

  // Convert the UTC time to the target time zone
  const localTime = utcTime.tz(tz);

  // Return the hour part of the time in the target time zone
  return localTime.hour();
}

export function getEndOfDay(date: Date, tz?: string): Date {
  if (tz) {
    const zonedDate = toZonedTime(date, tz);
    zonedDate.setHours(23, 59, 59, 999);
    return fromZonedTime(zonedDate, tz);
  }
  let end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}



export function getWeekDatesStartingMonday(date: Date): Date[] {
  let week: Date[] = [];

  let startDay = new Date(date);
  let dayOfWeek = startDay.getDay();
  let offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for weeks starting on Monday
  startDay.setDate(startDay.getDate() - offset);

  for (let i = 0; i < 7; i++) {
    let day = new Date(startDay);
    day.setDate(day.getDate() + i);
    week.push(day);
  }

  return week;
}