import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <div className="help">
        <Trans
          i18nKey="pagination.showing"
          ns="common"
          values={{ start, end, total }}
          components={{ strong: <strong /> }}
        />
      </div>
      <div className="paginationButtons">
        <button
          className="btn"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          aria-label={t('pagination.prev')}
        >
          <IconChevronLeft />
          {t('pagination.prev')}
        </button>
        <button
          className="btn"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          aria-label={t('pagination.next')}
        >
          {t('pagination.next')}
          <IconChevronRight />
        </button>
      </div>
    </div>
  );
}