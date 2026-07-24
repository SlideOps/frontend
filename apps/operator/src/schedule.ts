import type { Schedule } from '@slideops/api-client';

/*
 * The schedule helpers turn a small, explicit recurrence into plain language and
 * back, and provide a sensible starting schedule per frequency. The recurrence
 * itself is the backend contract; this module only reads and describes it, so a
 * schedule reads the same on the list, in the builder, and in any summary.
 */

/** Weekday names indexed the way the contract numbers them: Sunday is 0. */
export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** The frequencies an Operator can choose, in the order the builder shows them. */
export const FREQUENCIES: Schedule['frequency'][] = ['hourly', 'daily', 'weekly', 'monthly'];

/** A friendly title for each frequency, for menus and summaries. */
export const FREQUENCY_LABEL: Record<Schedule['frequency'], string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** Format the ordinal of a day of the month, for example 1st, 2nd, 3rd, 21st. */
function ordinal(day: number): string {
  const rem100 = day % 100;
  if (rem100 >= 11 && rem100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** The weekday name for an index, tolerant of an out of range value. */
export function weekdayName(weekday: number | undefined): string {
  if (weekday === undefined || weekday < 0 || weekday > 6) {
    return 'Sunday';
  }
  return WEEKDAYS[weekday] ?? 'Sunday';
}

/**
 * Describe a schedule in one plain-language line. Times are UTC, since the
 * backend computes the next run in UTC and saying so avoids any confusion about
 * whose clock a scheduled Operation follows.
 */
export function scheduleToText(schedule: Schedule): string {
  const time = schedule.time && /^\d{2}:\d{2}$/.test(schedule.time) ? schedule.time : '00:00';
  switch (schedule.frequency) {
    case 'hourly':
      return 'Every hour';
    case 'daily':
      return `Every day at ${time} UTC`;
    case 'weekly':
      return `Every ${weekdayName(schedule.weekday)} at ${time} UTC`;
    case 'monthly':
      return `On the ${ordinal(schedule.day_of_month ?? 1)} of each month at ${time} UTC`;
    default:
      return 'On a schedule';
  }
}

/** A sensible starting schedule for a frequency, so the builder is never blank. */
export function defaultSchedule(frequency: Schedule['frequency']): Schedule {
  switch (frequency) {
    case 'hourly':
      return { frequency: 'hourly' };
    case 'daily':
      return { frequency: 'daily', time: '02:00' };
    case 'weekly':
      return { frequency: 'weekly', weekday: 1, time: '02:00' };
    case 'monthly':
      return { frequency: 'monthly', day_of_month: 1, time: '02:00' };
    default:
      return { frequency: 'daily', time: '02:00' };
  }
}
