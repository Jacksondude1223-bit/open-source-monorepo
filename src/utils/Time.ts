export function utcToTimezone(utcTime: { hours: number; minutes: number }): {
  time24: string;
  time12: string;
} {
  // Create a new date object with the UTC hours and minutes
  const dateObj = new Date();
  dateObj.setUTCHours(utcTime.hours);
  dateObj.setUTCMinutes(utcTime.minutes);

  // Calculate the offset between the UTC and local timezones
  //const localOffset = dateObj.getTimezoneOffset();

  // Add the offset to the UTC time to get the local time
  //const localHours = utcTime.hours + (localOffset - timezoneOffset) / 60;
  //const localMinutes = utcTime.minutes - localOffset % 60;

  const localHours = dateObj.getHours();
  const localMinutes = dateObj.getMinutes();

  // Format the local time in 24-hour format
  const localTime24 = `${String(Math.floor(localHours)).padStart(
    2,
    '0',
  )}:${String(localMinutes).padStart(2, '0')}`;

  // Format the local time in 12-hour format
  let localHours12 = Math.floor(localHours) % 12;
  if (localHours12 === 0) {
    localHours12 = 12;
  }
  const ampm = localHours < 12 ? 'AM' : 'PM';
  const localTime12 = `${String(localHours12).padStart(2, '0')}:${String(
    localMinutes,
  ).padStart(2, '0')} ${ampm}`;

  // Return an object with both the 24-hour and 12-hour formats of the local time
  return { time24: localTime24, time12: localTime12 };
}

export function utcToDate(utcTime: { hours: number; minutes: number }): Date {
  // Create a new date object with the UTC hours and minutes
  const dateObj = new Date();
  dateObj.setUTCHours(utcTime.hours);
  dateObj.setUTCMinutes(utcTime.minutes);

  // Return an object with both the 24-hour and 12-hour formats of the local time
  return dateObj;
}