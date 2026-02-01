import React, { useMemo } from 'react';

export type DataTableAlign = 'left' | 'center' | 'right';

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  headerStyle?: React.CSSProperties;
  headerAlign?: DataTableAlign;
  cell: (row: T) => React.ReactNode;
  cellStyle?: React.CSSProperties | ((row: T) => React.CSSProperties | undefined);
  cellClassName?: string | ((row: T) => string | undefined);
  cellAlign?: DataTableAlign;
  dataLabel?: string;
};

export function getDataTableColSpan(columnCount: number): number {
  return Math.max(1, columnCount);
}

export function DataTable<T>({
  ariaLabel,
  columns,
  rows,
  rowKey,
  empty,
  loading,
  skeletonRows = 3,
  getRowProps
}: {
  ariaLabel: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  getRowProps?: (row: T) => React.HTMLAttributes<HTMLTableRowElement>;
}) {
  const colSpan = useMemo(() => getDataTableColSpan(columns.length), [columns.length]);

  if (loading && rows.length === 0) {
    return (
      <div className="p-4" aria-label={`${ariaLabel} loading`}>
        {Array.from({ length: skeletonRows }).map((_, idx) => (
          <div key={idx} className="skeleton skeletonTableRow" />
        ))}
      </div>
    );
  }

  return (
    <table className="table" aria-label={ariaLabel}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.id}
              style={{
                ...(col.headerStyle ?? null),
                textAlign: col.headerAlign ?? (col.headerStyle?.textAlign as any) ?? undefined
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} {...(getRowProps ? getRowProps(row) : null)}>
            {columns.map((col) => {
              const cellStyle = typeof col.cellStyle === 'function' ? col.cellStyle(row) : col.cellStyle;
              const cellClassName = typeof col.cellClassName === 'function' ? col.cellClassName(row) : col.cellClassName;
              return (
                <td
                  key={col.id}
                  className={cellClassName}
                  style={{
                    ...(cellStyle ?? null),
                    textAlign: col.cellAlign ?? (cellStyle?.textAlign as any) ?? undefined
                  }}
                  data-label={col.dataLabel}
                >
                  {col.cell(row)}
                </td>
              );
            })}
          </tr>
        ))}

        {!loading && rows.length === 0 && empty ? (
          <tr>
            <td colSpan={colSpan}>{empty}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

