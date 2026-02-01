import React from 'react';

interface LoadingStateProps {
  mode?: 'skeleton' | 'spinner';
  rows?: number;
  message?: string;
}

export function LoadingState({ mode = 'skeleton', rows = 3, message }: LoadingStateProps) {
  if (mode === 'spinner') {
    return (
      <div className="loadingState">
        <div className="loadingSpinner spin" />
        {message && <div className="loadingMessage">{message}</div>}
      </div>
    );
  }

  return (
    <div className="loadingState loadingState--skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeletonTableRow" />
      ))}
    </div>
  );
}

export function SkeletonKpi() {
  return <div className="skeleton skeletonKpi" />;
}
