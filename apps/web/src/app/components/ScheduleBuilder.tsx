import type { Schedule } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { useId } from 'react';
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  WEEKDAYS,
  defaultSchedule,
  scheduleToClause,
} from '../schedule';

/*
 * A small, friendly recurrence builder. The Operator picks a frequency, and only
 * the fields that frequency needs appear: a time for daily and up, a weekday for
 * weekly, a day of the month for monthly. A live plain-language summary reads the
 * schedule back so there is no doubt about when an Operation will run.
 */

const controlClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export interface ScheduleBuilderProps {
  value: Schedule;
  onChange: (schedule: Schedule) => void;
}

/** The days of the month an Automation may run on: 1 to 28, always valid. */
const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, index) => index + 1);

export function ScheduleBuilder({ value, onChange }: ScheduleBuilderProps) {
  const baseId = useId();
  const time = value.time ?? '02:00';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${baseId}-frequency`} className="text-sm font-medium text-ink">
          How often
        </label>
        <select
          id={`${baseId}-frequency`}
          className={controlClass}
          value={value.frequency}
          onChange={(event) =>
            onChange(defaultSchedule(event.target.value as Schedule['frequency']))
          }
        >
          {FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {FREQUENCY_LABEL[frequency]}
            </option>
          ))}
        </select>
      </div>

      {value.frequency === 'weekly' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${baseId}-weekday`} className="text-sm font-medium text-ink">
            On which day
          </label>
          <select
            id={`${baseId}-weekday`}
            className={controlClass}
            value={value.weekday ?? 1}
            onChange={(event) => onChange({ ...value, weekday: Number(event.target.value) })}
          >
            {WEEKDAYS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {value.frequency === 'monthly' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${baseId}-day`} className="text-sm font-medium text-ink">
            On which day of the month
          </label>
          <select
            id={`${baseId}-day`}
            className={controlClass}
            value={value.day_of_month ?? 1}
            onChange={(event) => onChange({ ...value, day_of_month: Number(event.target.value) })}
          >
            {DAYS_OF_MONTH.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
          <Text variant="body-sm" tone="secondary">
            Days run from 1 to 28 so every month has one.
          </Text>
        </div>
      ) : null}

      {value.frequency !== 'hourly' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${baseId}-time`} className="text-sm font-medium text-ink">
            At what time (UTC)
          </label>
          <input
            id={`${baseId}-time`}
            type="time"
            className={controlClass}
            value={time}
            onChange={(event) => onChange({ ...value, time: event.target.value })}
          />
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-subtle px-3 py-2">
        <Text variant="body-sm" tone="secondary">
          This Automation will run {scheduleToClause(value)}.
        </Text>
      </div>
    </div>
  );
}
