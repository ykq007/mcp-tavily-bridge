import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MetricsCard } from './MetricsCard';

describe('MetricsCard', () => {
  it('renders loading skeleton tiles', () => {
    const html = renderToStaticMarkup(
      <MetricsCard
        title="Real-time Metrics"
        subtitle="Traffic, health, and cost snapshot"
        liveLabel="Live"
        loading
        metrics={[]}
      />
    );

    expect(html).toContain('class="card metricsCard"');
    expect(html).toContain('class="metricsGrid"');
    expect(html).toContain('skeletonMetricTile');
  });

  it('renders semantic metric tiles with variants', () => {
    const html = renderToStaticMarkup(
      <MetricsCard
        title="Real-time Metrics"
        liveLabel="Live"
        metrics={[
          { label: 'Requests / min', value: 12, variant: 'neutral' },
          { label: 'Active Tokens', value: 3, variant: 'success' },
          { label: 'Unhealthy Keys', value: 1, variant: 'danger' }
        ]}
      />
    );

    expect(html).toContain('<dl');
    expect(html).toContain('class="metricTile"');
    expect(html).toContain('<dt class="metricLabel">');
    expect(html).toContain('<dd class="metricValue" data-variant="success">3</dd>');
    expect(html).toContain('<dd class="metricValue" data-variant="danger">1</dd>');
  });
});

