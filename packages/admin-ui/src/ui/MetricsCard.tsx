import React from 'react';

interface MetricsCardProps {
  title: string;
  subtitle?: string;
  liveLabel?: string;
  metrics: Array<{
    label: string;
    value: string | number;
    variant?: 'success' | 'warning' | 'danger' | 'neutral';
  }>;
  loading?: boolean;
}

export function MetricsCard({ title, subtitle, liveLabel, metrics, loading }: MetricsCardProps) {
  if (loading) {
    return (
      <div className="card metricsCard">
        <div className="cardHeader">
          <div className="row metricsCardHeader">
            <div className="metricsCardTitleStack">
              <div className="h2">{title}</div>
              {subtitle ? <div className="help">{subtitle}</div> : null}
            </div>
            {liveLabel ? (
              <span className="pill metricsLivePill" aria-live="polite">
                <span className="liveDot" aria-hidden="true" />
                <span>{liveLabel}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="cardBody">
          <div className="metricsGrid" aria-hidden="true">
            <div className="skeleton skeletonMetricTile" />
            <div className="skeleton skeletonMetricTile" />
            <div className="skeleton skeletonMetricTile" />
            <div className="skeleton skeletonMetricTile" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card metricsCard">
      <div className="cardHeader">
        <div className="row metricsCardHeader">
          <div className="metricsCardTitleStack">
            <div className="h2">{title}</div>
            {subtitle ? <div className="help">{subtitle}</div> : null}
          </div>
          {liveLabel ? (
            <span className="pill metricsLivePill" aria-live="polite">
              <span className="liveDot" aria-hidden="true" />
              <span>{liveLabel}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="cardBody">
        <dl className="metricsGrid" aria-label={title}>
          {metrics.map((metric, i) => (
            <div key={`${metric.label}-${i}`} className="metricTile">
              <dt className="metricLabel">{metric.label}</dt>
              <dd className="metricValue" data-variant={metric.variant || 'neutral'}>{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

interface RecentErrorsCardProps {
  errors: Array<{
    id: string;
    toolName: string;
    errorMessage: string | null;
    timestamp: string;
  }>;
  loading?: boolean;
}

export function RecentErrorsCard({ errors, loading }: RecentErrorsCardProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="cardHeader">
          <div className="h3">Recent Errors</div>
        </div>
        <div className="cardBody">
          <div className="skeleton skeletonTableRow" />
          <div className="skeleton skeletonTableRow" />
        </div>
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="card">
        <div className="cardHeader">
          <div className="h3">Recent Errors</div>
        </div>
        <div className="cardBody">
          <div className="help" style={{ textAlign: 'center', padding: '1rem' }}>
            No errors in the last hour
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="h3">Recent Errors</div>
      </div>
      <div className="cardBody p-0">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Tool</th>
              <th>Error</th>
              <th style={{ width: 160 }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((error) => (
              <tr key={error.id}>
                <td className="mono">{error.toolName}</td>
                <td className="mono" style={{ color: 'var(--color-danger)' }}>
                  {error.errorMessage || 'Unknown error'}
                </td>
                <td className="mono">
                  {new Date(error.timestamp).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
