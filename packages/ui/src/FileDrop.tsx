import { cn, Text } from '@slideops/design-system';
import { CheckCircle2, AlertTriangle, Loader2, Upload } from '@slideops/icons';
import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';

/*
 * Drag a file in, or click to browse for one. The one way in for a database
 * dump, however an Operator already has it on their machine.
 *
 * Status is a prop rather than internal state, because dropping a file and
 * uploading it are two different things happening at two different layers:
 * this component only ever hands back the files it was given. Whoever is
 * actually sending them over the wire owns whether that is in progress, done,
 * or failed, and tells this component so it can say so.
 */

export type FileDropStatus = 'idle' | 'uploading' | 'done' | 'error';

export interface FileDropProps {
  onFiles: (files: File[]) => void;
  /** A comma separated extension or MIME list, exactly as the input accept attribute takes it. */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  hint?: ReactNode;
  status?: FileDropStatus;
  statusMessage?: ReactNode;
  className?: string;
}

const STATUS_ICON: Record<Exclude<FileDropStatus, 'idle'>, ReactNode> = {
  uploading: <Loader2 width={20} height={20} className="animate-spin text-brand" aria-hidden />,
  done: <CheckCircle2 width={20} height={20} className="text-success" aria-hidden />,
  error: <AlertTriangle width={20} height={20} className="text-danger" aria-hidden />,
};

export function FileDrop({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  label = 'Drop a file here, or click to browse',
  hint,
  status = 'idle',
  statusMessage,
  className,
}: FileDropProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const busy = status === 'uploading' || disabled;

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) {
      return;
    }
    onFiles(Array.from(list));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (busy) {
      return;
    }
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!busy && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) {
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center',
          'transition-colors duration-fast ease-standard',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
          busy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          dragging ? 'border-brand bg-subtle' : 'border-border bg-surface hover:bg-subtle',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            // Cleared so choosing the same file twice in a row still fires a
            // change event; a browser otherwise treats it as no change at all.
            event.target.value = '';
          }}
        />
        {status !== 'idle' ? (
          STATUS_ICON[status]
        ) : (
          <Upload width={20} height={20} className="text-ink-muted" aria-hidden />
        )}
        <Text variant="body-sm" tone={status === 'error' ? undefined : 'secondary'} className={status === 'error' ? 'text-danger' : undefined}>
          {status === 'idle' ? label : (statusMessage ?? label)}
        </Text>
        {hint && status === 'idle' ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
