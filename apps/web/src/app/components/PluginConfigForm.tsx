import { ApiError, type PluginConfigParameter } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  buildParameterSchema,
  cleanParameterValues,
  defaultParameterValues,
} from '../parameter-schema';
import { ParameterFields } from './ParameterFields';

/*
 * The generated Plugin configuration form. It reuses the same ParameterFields
 * and Zod schema builder that a Capability's inputs use, so a Plugin's config is
 * rendered and validated the same way an Operation's parameters are. Both
 * installing and reconfiguring a Plugin render this. When the Plugin declares no
 * config it is a single confirm button; the collected values travel to the
 * caller as the Plugin config.
 */
export function PluginConfigForm({
  config,
  submitLabel,
  pendingLabel,
  note,
  onSubmit,
}: {
  config: readonly PluginConfigParameter[];
  submitLabel: string;
  pendingLabel: string;
  note?: ReactNode;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}) {
  const schema = useMemo(() => buildParameterSchema(config), [config]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: defaultParameterValues(config),
  });

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(cleanParameterValues(values));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'This could not be saved. Try again.');
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
      {config.length > 0 ? (
        <ParameterFields
          idPrefix="plugin-config"
          parameters={config}
          register={register}
          errors={errors}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? pendingLabel : submitLabel}
        </Button>
        {note ? (
          <Text variant="body-sm" tone="secondary">
            {note}
          </Text>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
