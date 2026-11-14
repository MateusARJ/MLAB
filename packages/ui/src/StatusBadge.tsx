import React from 'react';

export interface StatusBadgeProps {
  status: 'live' | 'paused' | 'waiting' | 'error' | 'info' | 'neutral';
  label: string;
  icon?: React.ReactNode;
  pulse?: boolean;
  style?: React.CSSProperties;
}

const STATUS_CLASS: Record<StatusBadgeProps['status'], string> = {
  live: 'ml-status--live',
  paused: 'ml-status--wait',
  waiting: 'ml-status--wait',
  error: 'ml-status--error',
  info: 'ml-status--info',
  neutral: '',
};

/** Selo de estado: sempre ponto (ou ícone) + texto, nunca só cor. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, icon, pulse = false, style }) => {
  const classes = ['ml-status', STATUS_CLASS[status] || '', icon ? 'ml-status--plain' : '', pulse ? 'is-pulsing' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} style={style}>
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span>{label}</span>
    </span>
  );
};
