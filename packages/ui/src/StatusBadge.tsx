import React from 'react';
import { colors, radii, typography } from './tokens';

export interface StatusBadgeProps {
  status: 'live' | 'paused' | 'waiting' | 'error' | 'info' | 'neutral';
  label: string;
  icon?: React.ReactNode;
  pulse?: boolean;
  style?: React.CSSProperties;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  icon,
  pulse = false,
  style,
}) => {
  const configs = {
    live: {
      bg: colors.successSoft,
      border: colors.success,
      color: '#4ade80',
      dotColor: '#22c55e',
    },
    paused: {
      bg: colors.warningSoft,
      border: colors.warning,
      color: colors.warningText,
      dotColor: colors.warning,
    },
    waiting: {
      bg: colors.warningSoft,
      border: colors.warning,
      color: colors.warningText,
      dotColor: colors.warning,
    },
    error: {
      bg: colors.dangerSoft,
      border: colors.danger,
      color: colors.dangerText,
      dotColor: colors.danger,
    },
    info: {
      bg: colors.primarySoft,
      border: colors.primary,
      color: colors.accent,
      dotColor: colors.accent,
    },
    neutral: {
      bg: 'rgba(148, 163, 184, 0.1)',
      border: colors.borderInteractive,
      color: colors.textSecondary,
      dotColor: colors.textMuted,
    },
  };

  const cfg = configs[status] || configs.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: radii.full,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: '12px',
        fontWeight: 600,
        fontFamily: typography.fontFamily,
        letterSpacing: '0.02em',
        boxSizing: 'border-box',
        userSelect: 'none',
        ...style,
      }}
    >
      {icon ? (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      ) : (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: cfg.dotColor,
            boxShadow: pulse ? `0 0 6px ${cfg.dotColor}` : 'none',
          }}
        />
      )}
      <span>{label}</span>
    </span>
  );
};
