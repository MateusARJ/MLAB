import React from 'react';

export interface CardProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/** Painel: superfície com borda, sem sombra nem blur. */
export const Card: React.FC<CardProps> = ({ title, subtitle, headerRight, children, style, className }) => {
  return (
    <div className={`ml-card${className ? ` ${className}` : ''}`} style={style}>
      {(title || subtitle || headerRight) && (
        <div className="ml-card__head">
          <div>
            {title && <h3 className="ml-card__title">{title}</h3>}
            {subtitle && <p className="ml-card__subtitle">{subtitle}</p>}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
