import type { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  highlights: string[];
}

function FeatureCard({ icon, title, description, highlights }: FeatureCardProps) {
  return (
    <article className="feature-card">
      <div className="feature-card__icon">{icon}</div>
      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__description">{description}</p>
      <ul className="feature-card__highlights">
        {highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

export function Features() {
  return (
    <section className="features" id="features" aria-labelledby="features-title">
      <div className="landing-shell features__container">
        <header className="features__header">
          <p className="features__eyebrow">PLATFORM CAPABILITIES</p>
          <h2 className="features__title" id="features-title">
            Everything needed to operate a search bridge at scale
          </h2>
          <p className="features__subtitle">
            From routing reliability to observability, MCP Nexus provides the core blocks to
            keep provider-backed search available and measurable.
          </p>
        </header>

        <div className="features__grid">
          <FeatureCard
            icon={
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            }
            title="Provider abstraction"
            description="A single MCP-facing interface across Tavily and Brave tool surfaces."
            highlights={[
              'Unified endpoint and response handling',
              'Provider fallback and continuity behavior',
              'Low-friction integration for MCP clients'
            ]}
          />

          <FeatureCard
            icon={
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
            }
            title="Intelligent key lifecycle"
            description="Protect quotas and uptime with automatic rotation and cooldown recovery."
            highlights={[
              'Credit-aware selection controls',
              'Cooldown and health-state enforcement',
              'Operational safeguards for burst traffic'
            ]}
          />

          <FeatureCard
            icon={
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            }
            title="Admin observability"
            description="Track request trends, usage, and key status in one focused dashboard."
            highlights={[
              'Live usage and route diagnostics',
              'Rapid troubleshooting for degraded providers',
              'Operational data built for maintenance workflows'
            ]}
          />

          <FeatureCard
            icon={
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 1 12.96-5.303M4.5 12H3m1.5 0h3m13.5 0a7.5 7.5 0 0 1-12.96 5.303M19.5 12H21m-1.5 0h-3" />
              </svg>
            }
            title="Production-ready controls"
            description="Run confidently with route checks, health endpoints, and predictable behavior."
            highlights={[
              'Health status endpoint for automation',
              'Clear integration pathways (stdio + HTTP)',
              'Consistent controls for operational teams'
            ]}
          />
        </div>
      </div>
    </section>
  );
}
