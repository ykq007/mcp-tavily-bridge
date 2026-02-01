import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'ghost';
  };
  compact?: boolean;
}

export function EmptyState({ icon, title, message, action, compact }: EmptyStateProps) {
  return (
    <div className={compact ? 'emptyState emptyState--compact' : 'emptyState'}>
      {icon && <div className="emptyStateIcon">{icon}</div>}
      {title && <div className="emptyStateTitle">{title}</div>}
      <div className="emptyStateMessage">{message}</div>
      {action && (
        <button
          className="btn"
          data-variant={action.variant ?? 'primary'}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
