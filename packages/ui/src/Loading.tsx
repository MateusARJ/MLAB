import React from 'react';
import { colors } from './tokens';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  description?: string;
  style?: React.CSSProperties;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  active = true,
  description,
  style,
}) => {
  if (!active) return null;

  const sizePx = size === 'sm' ? 24 : size === 'lg' ? 56 : 36;
  const strokeWidth = size === 'sm' ? 3 : 4;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        ...style,
      }}
      role="progressbar"
      aria-label={description || 'Carregando...'}
    >
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 100 100"
        style={{
          animation: 'cds--spin 1s linear infinite',
        }}
      >
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgba(2, 132, 199, 0.15)"
          strokeWidth={strokeWidth * 2.5}
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={colors.primary}
          strokeWidth={strokeWidth * 2.5}
          strokeDasharray="200"
          strokeDashoffset="120"
          strokeLinecap="round"
        />
      </svg>
      {description && (
        <span style={{ fontSize: '13px', color: colors.textSecondary }}>
          {description}
        </span>
      )}
    </div>
  );
};
