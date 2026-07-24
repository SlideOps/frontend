import type { Schedule } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import { defaultSchedule, scheduleToText, weekdayName } from './schedule';

describe('scheduleToText', () => {
  it('describes an hourly schedule without a time', () => {
    expect(scheduleToText({ frequency: 'hourly' })).toBe('Every hour');
  });

  it('describes a daily schedule with its UTC time', () => {
    expect(scheduleToText({ frequency: 'daily', time: '02:00' })).toBe('Every day at 02:00 UTC');
  });

  it('names the weekday for a weekly schedule', () => {
    const schedule: Schedule = { frequency: 'weekly', weekday: 1, time: '09:30' };
    expect(scheduleToText(schedule)).toBe('Every Monday at 09:30 UTC');
  });

  it('uses an ordinal day for a monthly schedule', () => {
    expect(scheduleToText({ frequency: 'monthly', day_of_month: 1, time: '00:00' })).toBe(
      'On the 1st of each month at 00:00 UTC',
    );
    expect(scheduleToText({ frequency: 'monthly', day_of_month: 22, time: '00:00' })).toBe(
      'On the 22nd of each month at 00:00 UTC',
    );
  });

  it('falls back to midnight when the time is missing or malformed', () => {
    expect(scheduleToText({ frequency: 'daily' })).toBe('Every day at 00:00 UTC');
    expect(scheduleToText({ frequency: 'daily', time: 'noon' })).toBe('Every day at 00:00 UTC');
  });
});

describe('weekdayName', () => {
  it('maps Sunday to index zero and tolerates an out of range value', () => {
    expect(weekdayName(0)).toBe('Sunday');
    expect(weekdayName(6)).toBe('Saturday');
    expect(weekdayName(9)).toBe('Sunday');
    expect(weekdayName(undefined)).toBe('Sunday');
  });
});

describe('defaultSchedule', () => {
  it('gives each frequency a complete starting shape', () => {
    expect(defaultSchedule('hourly')).toEqual({ frequency: 'hourly' });
    expect(defaultSchedule('weekly')).toMatchObject({ frequency: 'weekly', weekday: 1 });
    expect(defaultSchedule('monthly')).toMatchObject({ frequency: 'monthly', day_of_month: 1 });
  });
});
