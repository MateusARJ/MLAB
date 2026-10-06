import React from 'react';
import { colors, radii, typography } from './tokens';

export interface AlertProps {
  variant?: 'info' | 'error' | 'warning' | 'success';
  title?: string;
  message: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  message,
  icon,
  onClose,
  style,
}) => {
  const configs = {
    info: {
      bg: colors.primarySoft,
      border: colors.primary,
      color: colors.accent,
    },
    error: {
      bg: colors.dangerSoft,
      border: colors.danger,
      color: colors.dangerText,
    },
    warning: {
      bg: colors.warningSoft,
      border: colors.warning,
      color: colors.warningText,
    },
    success: {
      bg: colors.successSoft,
      border: colors.success,
      color: '#4ade80',
    },
  };

  const cfg = configs[variant] || configs.info;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: radii.md,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: '13px',
        lineHeight: 1.4,
        fontFamily: typography.fontFamily,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {icon && (
        <span style={{ display: 'flex', marginTop: '1px', flexShrink: 0 }}>
          {icon}
        </span>
      )}
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: '2px' }}>{title}</div>}
        <div>{message}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: cfg.color,
            cursor: 'pointer',
            padding: 0,
            fontSize: '16px',
            lineHeight: 1,
            opacity: 0.8,
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
};
