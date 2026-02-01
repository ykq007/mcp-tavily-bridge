import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTable, getDataTableColSpan, type DataTableColumn } from './DataTable';

describe('getDataTableColSpan', () => {
  it('never returns less than 1', () => {
    expect(getDataTableColSpan(0)).toBe(1);
    expect(getDataTableColSpan(-1)).toBe(1);
  });
});

describe('DataTable', () => {
  it('renders empty slot with correct colSpan', () => {
    type Row = { id: string; name: string };
    const columns: DataTableColumn<Row>[] = [
      { id: 'name', header: 'Name', dataLabel: 'Name', cell: (r) => r.name },
      { id: 'id', header: 'ID', dataLabel: 'ID', cell: (r) => r.id }
    ];

    const html = renderToStaticMarkup(
      <DataTable
        ariaLabel="Test table"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        empty={<div className="emptyState">No rows</div>}
      />
    );

    expect(html).toContain('aria-label="Test table"');
    expect(html).toContain('colSpan="2"');
    expect(html).toContain('No rows');
  });
});
