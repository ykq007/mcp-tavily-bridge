import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'ghost' | 'primary' | 'danger' | 'ghost-danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function IconButton({ icon, variant = 'ghost', size = 'md', loading, className, ...props }: IconButtonProps) {
  const classes = [
    'iconBtn',
    size === 'sm' && 'iconBtn--sm',
    variant !== 'ghost' && `iconBtn--${variant}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={loading || props.disabled}
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
}
