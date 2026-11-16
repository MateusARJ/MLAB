import React from 'react';

export interface AlertProps {
  variant?: 'info' | 'error' | 'warning' | 'success';
  title?: string;
  message: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
}

/** Aviso em linha: barra de cor à esquerda, título opcional que resume, texto que orienta. */
export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, message, icon, onClose, style }) => {
  return (
    <div role="alert" className={`ml-banner ml-banner--${variant}`} style={style}>
      {icon && <span style={{ display: 'flex', marginTop: '1px', flexShrink: 0 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <strong>{title}</strong>}
        <div>{message}</div>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="ml-banner__close" aria-label="Fechar aviso">
          &times;
        </button>
      )}
    </div>
  );
};
