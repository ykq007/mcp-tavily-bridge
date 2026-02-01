import React from 'react';
import { IconChevronLeft, IconChevronRight } from './icons';

export function Pagination({
  total,
  page,
  pageSize,
  onChange
}: {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <div className="help">
        Showing <strong>{start}</strong> to <strong>{end}</strong> of <strong>{total}</strong> results
      </div>
      <div className="paginationButtons">
        <button
          className="btn"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <IconChevronLeft />
          Prev
        </button>
        <button
          className="btn"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}