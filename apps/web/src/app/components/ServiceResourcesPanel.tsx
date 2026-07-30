import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, updateServiceResources, type Service } from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { CheckCircle2, Gauge } from '@slideops/icons';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ErrorNote } from './Feedback';

/*
 * The Allocation card. It resizes a running Service's resource ceilings, CPU,
 * memory, and the process limit, in place. The backend applies the new limits to
 * the running workload with no rebuild or restart, so the copy makes the live,
 * no-downtime nature explicit. The three limits are the Operator's own choice on
 * their own server, so validation only holds each to a value above zero, mirroring
 * the backend contract. Every color is a semantic token, so the card reads
 * correctly in both themes.
 */

/** Mirror the backend rule: each limit must be greater than zero. */
const resourcesSchema = z.object({
  cpu_limit: z.coerce
    .number({ invalid_type_error: 'Enter a vCPU limit.' })
    .gt(0, 'Enter a vCPU limit above zero.'),
  memory_mb: z.coerce
    .number({ invalid_type_error: 'Enter a memory limit.' })
    .int('Enter memory as a whole number of MB.')
    .gt(0, 'Enter a memory limit above zero.'),
  pids_limit: z.coerce
    .number({ invalid_type_error: 'Enter a process limit.' })
    .int('Enter the process limit as a whole number.')
    .gt(0, 'Enter a process limit above zero.'),
});

type ResourcesFormValues = z.infer<typeof resourcesSchema>;

export interface ServiceResourcesPanelProps {
  service: Service;
  /** Called with the updated Service so the screen reflects the new limits at once. */
  onUpdated: (service: Service) => void;
}

/**
 * The resource-allocation card: current CPU, memory, and process limit, each
 * editable, with a single Apply action that resizes the running workload live.
 * Apply is disabled while a request is in flight and while the values are
 * unchanged. A 400 invalid_resources comes back as a friendly inline message; any
 * other failure shows through the shared ErrorNote.
 */
export function ServiceResourcesPanel({ service, onUpdated }: ServiceResourcesPanelProps) {
  // The process limit is required to resize, so fall back to the current CPU-side
  // default of one when a Service has never carried one.
  const currentPids = service.pids_limit ?? 1;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResourcesFormValues>({
    resolver: zodResolver(resourcesSchema),
    defaultValues: {
      cpu_limit: service.cpu_limit,
      memory_mb: service.memory_mb,
      pids_limit: currentPids,
    },
  });

  const [invalidMessage, setInvalidMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [applied, setApplied] = useState(false);

  // Keep the fields in step with the Service should it change underneath the card
  // (for example after another action refetches it).
  useEffect(() => {
    reset({
      cpu_limit: service.cpu_limit,
      memory_mb: service.memory_mb,
      pids_limit: currentPids,
    });
  }, [reset, service.cpu_limit, service.memory_mb, currentPids]);

  const values = watch();
  const changed =
    Number(values.cpu_limit) !== service.cpu_limit ||
    Number(values.memory_mb) !== service.memory_mb ||
    Number(values.pids_limit) !== currentPids;

  // Any edit clears the last outcome so a stale confirmation or error never lingers.
  useEffect(() => {
    if (changed) {
      setApplied(false);
      setInvalidMessage(null);
      setFailure(null);
    }
  }, [changed]);

  const onSubmit = handleSubmit(async (form) => {
    setInvalidMessage(null);
    setFailure(null);
    setApplied(false);
    try {
      const updated = await updateServiceResources(service.id, {
        cpu_limit: form.cpu_limit,
        memory_mb: form.memory_mb,
        pids_limit: form.pids_limit,
      });
      reset({
        cpu_limit: updated.cpu_limit,
        memory_mb: updated.memory_mb,
        pids_limit: updated.pids_limit ?? form.pids_limit,
      });
      setApplied(true);
      onUpdated(updated);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invalid_resources') {
        setInvalidMessage(
          error.message ||
            'Each limit must be a value greater than zero. Adjust them and apply again.',
        );
      } else if (error instanceof ApiError) {
        setFailure(error);
      } else {
        setFailure(
          new ApiError(0, 'unknown_error', 'The allocation could not be updated. Try again.'),
        );
      }
    }
  });

  return (
    <Card className="h-fit">
      <div className="flex items-center gap-2">
        <Gauge width={16} height={16} className="text-ink-muted" aria-hidden />
        <Text variant="h4">Allocation</Text>
      </div>
      <Text variant="body-sm" tone="secondary" className="mt-1">
        Resize the ceilings this Service runs under. The new limits are applied to the running
        workload in place, with no restart and no downtime.
      </Text>

      <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <Field
          label="vCPU limit"
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          error={errors.cpu_limit?.message}
          {...register('cpu_limit')}
        />
        <Field
          label="Memory (MB)"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          error={errors.memory_mb?.message}
          {...register('memory_mb')}
        />
        <Field
          label="Process limit"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          error={errors.pids_limit?.message}
          {...register('pids_limit')}
        />

        {invalidMessage ? (
          <p role="alert" className="text-sm text-danger">
            {invalidMessage}
          </p>
        ) : null}

        {failure ? <ErrorNote error={failure} /> : null}

        {applied ? (
          <div role="status" className="flex items-center gap-2">
            <CheckCircle2 width={16} height={16} className="shrink-0 text-success" aria-hidden />
            <Text variant="body-sm" tone="secondary">
              Updated. The new limits are running now, applied live with no restart.
            </Text>
          </div>
        ) : null}

        <div>
          <Button type="submit" disabled={isSubmitting || !changed}>
            {isSubmitting ? 'Applying' : 'Apply'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
