import React from 'react';

interface LoadingStateProps {
  mode?: 'skeleton' | 'spinner';
  rows?: number;
  message?: string;
}

export function LoadingState({ mode = 'skeleton', rows = 3, message }: LoadingStateProps) {
  if (mode === 'spinner') {
    return (
      <div className="loadingState" role="status" aria-live="polite" aria-busy="true">
        <div className="loadingSpinner spin" aria-hidden="true" />
        {message && <div className="loadingMessage">{message}</div>}
      </div>
    );
  }

  return (
    <div className="loadingState loadingState--skeleton" role="status" aria-live="polite" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeletonTableRow" aria-hidden="true" />
      ))}
    </div>
  );
}

export function SkeletonKpi() {
  return <div className="skeleton skeletonKpi" aria-hidden="true" />;
}
