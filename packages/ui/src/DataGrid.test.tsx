import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataGrid, type DataGridColumn, type DataGridRow } from './DataGrid';

const columns: DataGridColumn[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'size', header: 'Size', sortable: true, align: 'end' },
];

const rows: DataGridRow[] = [
  { id: '1', cells: { name: 'zeta', size: '10' }, sortValues: { size: 10 } },
  { id: '2', cells: { name: 'alpha', size: '3' }, sortValues: { size: 3 } },
];

function bodyRows() {
  return screen.getAllByRole('row').slice(1); // drop the header row
}

function firstCellText(row: HTMLElement): string | null {
  return within(row).getAllByRole('cell')[0]?.textContent ?? null;
}

describe('DataGrid', () => {
  it('renders every row in the order given', () => {
    render(<DataGrid columns={columns} rows={rows} />);
    const cells = bodyRows().map(firstCellText);
    expect(cells).toEqual(['zeta', 'alpha']);
  });

  it('shows the empty message in the Operator\'s language when there are no rows', () => {
    render(<DataGrid columns={columns} rows={[]} emptyMessage="No tables yet." />);
    expect(screen.getByText('No tables yet.')).toBeDefined();
  });

  it('sorts by a clicked sortable column, ascending then descending then off', async () => {
    const user = userEvent.setup();
    render(<DataGrid columns={columns} rows={rows} />);
    const header = screen.getByRole('button', { name: /Name/ });

    await user.click(header);
    expect(bodyRows().map(firstCellText)).toEqual([
      'alpha',
      'zeta',
    ]);

    await user.click(header);
    expect(bodyRows().map(firstCellText)).toEqual([
      'zeta',
      'alpha',
    ]);

    await user.click(header);
    expect(bodyRows().map(firstCellText)).toEqual([
      'zeta',
      'alpha',
    ]);
  });

  it('sorts by sortValues rather than the rendered cell when both are given', async () => {
    const user = userEvent.setup();
    render(<DataGrid columns={columns} rows={rows} />);
    await user.click(screen.getByRole('button', { name: /Size/ }));
    expect(bodyRows().map(firstCellText)).toEqual([
      'alpha',
      'zeta',
    ]);
  });

  it('does not let a click on an unsortable column do anything', () => {
    render(
      <DataGrid
        columns={[{ key: 'name', header: 'Name' }]}
        rows={[{ id: '1', cells: { name: 'a' } }]}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('activates a clickable row from the keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DataGrid
        columns={[{ key: 'name', header: 'Name' }]}
        rows={[{ id: '1', cells: { name: 'a' }, onClick }]}
      />,
    );
    const row = bodyRows()[0]!;
    row.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });
});
