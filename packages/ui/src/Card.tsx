import React from 'react';
import { colors, radii, typography } from './tokens';

export interface CardProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerRight,
  children,
  style,
  className,
}) => {
  return (
    <div
      className={className}
      style={{
        backgroundColor: colors.surfaceCard,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${colors.borderSubtle}`,
        borderRadius: radii.lg,
        padding: '28px 24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        boxSizing: 'border-box',
        fontFamily: typography.fontFamily,
        ...style,
      }}
    >
      {(title || subtitle || headerRight) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 700,
                  color: colors.textPrimary,
                  lineHeight: '28px',
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '14px',
                  color: colors.textMuted,
                  lineHeight: '20px',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
