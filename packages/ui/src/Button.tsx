import React, { useState } from 'react';
import { colors, radii, typography } from './tokens';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-ghost' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  loading = false,
  disabled = false,
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}) => {
  const [hovered, setHovered] = useState(false);

  // Tamanhos
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: '12px', minHeight: '32px', gap: '6px' },
    md: { padding: '10px 16px', fontSize: '14px', minHeight: '40px', gap: '8px' },
    lg: { padding: '14px 20px', fontSize: '15px', minHeight: '48px', gap: '10px' },
  };

  // Variantes
  let bg: string = colors.primary;
  let color: string = '#ffffff';
  let border: string = 'none';

  if (variant === 'primary') {
    bg = hovered ? colors.primaryHover : colors.primary;
    color = '#ffffff';
  } else if (variant === 'secondary') {
    bg = hovered ? colors.surfaceHover : 'transparent';
    color = colors.textPrimary;
    border = `1px solid ${colors.borderInteractive}`;
  } else if (variant === 'danger') {
    bg = hovered ? colors.dangerHover : colors.danger;
    color = '#ffffff';
  } else if (variant === 'danger-ghost') {
    bg = hovered ? colors.dangerSoft : 'transparent';
    color = colors.danger;
  } else if (variant === 'ghost') {
    bg = hovered ? colors.surfaceHover : 'transparent';
    color = colors.textSecondary;
  } else if (variant === 'success') {
    bg = hovered ? '#15803d' : colors.success;
    color = '#ffffff';
  }

  const baseStyle: React.CSSProperties = {
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: bg,
    color,
    border,
    fontFamily: typography.fontFamily,
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'all 0.15s ease-in-out',
    outline: 'none',
    boxSizing: 'border-box',
    userSelect: 'none',
    textDecoration: 'none',
    ...sizeStyles[size],
    ...style,
  };

  return (
    <button
      disabled={disabled || loading}
      style={baseStyle}
      onMouseEnter={(e) => {
        setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        onMouseLeave?.(e);
      }}
      {...rest}
    >
      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '14px',
              height: '14px',
              border: `2px solid ${color}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block',
            }}
          />
          {children}
        </span>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span style={{ display: 'flex' }}>{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span style={{ display: 'flex' }}>{icon}</span>}
        </>
      )}
    </button>
  );
};
