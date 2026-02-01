import React from 'react';

interface KpiCardProps {
  title?: string;  // Support both 'title' (old) and 'label' (OverviewPage)
  label?: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; isPositive: boolean };
  hint?: string;  // Support OverviewPage's 'hint' prop
  variant?: 'primary' | 'success' | 'warning' | 'neutral' | 'keys' | 'tokens' | 'usage';
  onClick?: () => void;  // Make it optionally clickable
}

export function KpiCard({
  title,
  label,
  value,
  icon,
  trend,
  hint,
  variant = 'neutral',
  onClick
}: KpiCardProps) {
  const displayTitle = title || label;
  const Component = onClick ? 'button' : 'div';
  const className = onClick ? 'card kpiCard' : 'kpiCard';

  return (
    <Component className={className} onClick={onClick} data-variant={variant}>
      <div className="kpiCardHeader">
        <div className="muted text-xs font-bold uppercase" style={{ letterSpacing: '0.08em' }}>
          {displayTitle}
        </div>
        {icon && <div className="kpiCardIcon" data-variant={variant}>{icon}</div>}
      </div>
      <div className="kpiValue">{value}</div>
      <div className="kpiCardFooter">
        {trend && (
          <>
            <span className="badge" data-variant={trend.isPositive ? 'success' : 'danger'}>
              {trend.value}
            </span>
          </>
        )}
        {hint && <div className="help">{hint}</div>}
        {onClick && <span className="kpiCardArrow">→</span>}
      </div>
    </Component>
  );
}
