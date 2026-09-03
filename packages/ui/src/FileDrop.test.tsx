import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FileDrop } from './FileDrop';

function dumpFile() {
  return new File(['dump contents'], 'app.sql', { type: 'application/sql' });
}

function firstReportedFileName(onFiles: ReturnType<typeof vi.fn>): string {
  const files = onFiles.mock.calls[0]?.[0] as File[] | undefined;
  return files?.[0]?.name ?? '';
}

describe('FileDrop', () => {
  it('reports a file chosen through the picker', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(<FileDrop onFiles={onFiles} label="Drop a dump" />);

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    await user.upload(input!, dumpFile());

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(firstReportedFileName(onFiles)).toBe('app.sql');
  });

  it('reports a file dropped onto the zone', () => {
    const onFiles = vi.fn();
    render(<FileDrop onFiles={onFiles} label="Drop a dump" />);

    const zone = screen.getByRole('button', { name: 'Drop a dump' });
    const file = dumpFile();
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(firstReportedFileName(onFiles)).toBe('app.sql');
  });

  it('refuses input while uploading', () => {
    const onFiles = vi.fn();
    render(<FileDrop onFiles={onFiles} label="Drop a dump" status="uploading" />);

    const zone = screen.getByRole('button', { name: 'Drop a dump' });
    expect(zone.getAttribute('aria-disabled')).toBe('true');

    fireEvent.drop(zone, { dataTransfer: { files: [dumpFile()] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('shows the status message in place of the label once given one', () => {
    render(<FileDrop onFiles={() => {}} label="Drop a dump" status="error" statusMessage="That file was rejected." />);
    expect(screen.getByText('That file was rejected.')).toBeDefined();
    expect(screen.queryByText('Drop a dump')).toBeNull();
  });
});
