import React, { useState } from 'react';
import { colors, radii } from './tokens';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'secondary' | 'danger' | 'primary' | 'success';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  active = false,
  disabled = false,
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}) => {
  const [hovered, setHovered] = useState(false);

  const sizeDimensions: Record<string, { width: string; height: string; fontSize: string }> = {
    sm: { width: '32px', height: '32px', fontSize: '14px' },
    md: { width: '40px', height: '40px', fontSize: '18px' },
    lg: { width: '48px', height: '48px', fontSize: '20px' },
  };

  let bg: string = 'transparent';
  let color: string = colors.textSecondary;
  let border: string = 'none';

  if (variant === 'ghost') {
    bg = active ? colors.surfaceHover : (hovered ? 'rgba(255, 255, 255, 0.08)' : 'transparent');
    color = active ? colors.accent : (hovered ? colors.textPrimary : colors.textSecondary);
  } else if (variant === 'secondary') {
    bg = hovered ? colors.surfaceHover : 'transparent';
    color = colors.textPrimary;
    border = `1px solid ${colors.borderInteractive}`;
  } else if (variant === 'primary') {
    bg = hovered ? colors.primaryHover : colors.primary;
    color = '#ffffff';
  } else if (variant === 'danger') {
    bg = hovered ? colors.dangerHover : colors.danger;
    color = '#ffffff';
  } else if (variant === 'success') {
    bg = hovered ? '#15803d' : colors.success;
    color = '#ffffff';
  }

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: bg,
    color,
    border,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease-in-out',
    outline: 'none',
    boxSizing: 'border-box',
    userSelect: 'none',
    ...sizeDimensions[size],
    ...style,
  };

  return (
    <button
      disabled={disabled}
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
      {children}
    </button>
  );
};
