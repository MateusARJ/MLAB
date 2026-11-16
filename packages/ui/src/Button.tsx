import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-ghost' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  loading?: boolean;
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'ml-btn--primary',
  secondary: 'ml-btn--secondary',
  danger: 'ml-btn--danger',
  'danger-ghost': 'ml-btn--danger-quiet',
  ghost: 'ml-btn--ghost',
  // "success" era o verde de avançar: no DS 2.0 a ação principal é sempre azul.
  success: 'ml-btn--primary',
};

/** Botão do DS 2.0. Hover, foco e pressionado vêm do CSS (components.css). */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  loading = false,
  disabled = false,
  children,
  className,
  ...rest
}) => {
  const classes = [
    'ml-btn',
    VARIANT_CLASS[variant],
    size === 'sm' ? 'ml-btn--sm' : size === 'lg' ? 'ml-btn--lg' : '',
    fullWidth ? 'ml-btn--block' : '',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <>
          <span className="ml-spinner" aria-hidden="true" />
          {children}
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="ml-btn__icon">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="ml-btn__icon">{icon}</span>}
        </>
      )}
    </button>
  );
};
