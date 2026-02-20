import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'ghost' | 'primary' | 'danger' | 'ghost-danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, variant = 'ghost', size = 'md', loading, className, ...props },
  ref
) {
  const classes = [
    'iconBtn',
    size === 'sm' && 'iconBtn--sm',
    variant !== 'ghost' && `iconBtn--${variant}`,
    className
  ].filter(Boolean).join(' ');

  // Auto-fallback: use title as aria-label if no aria-label or aria-labelledby provided
  const ariaLabel =
    typeof props['aria-label'] === 'string'
      ? props['aria-label']
      : typeof props['aria-labelledby'] === 'string'
        ? undefined
        : typeof props.title === 'string'
          ? props.title
          : undefined;

  return (
    <button
      ref={ref}
      className={classes}
      disabled={loading || props.disabled}
      aria-label={ariaLabel}
      {...props}
    >
      {loading ? (
        <div
          className="spin"
          style={{
            width: 14,
            height: 14,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%'
          }}
        />
      ) : icon}
    </button>
  );
});
