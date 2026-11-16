import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'secondary' | 'danger' | 'primary' | 'success';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

/** Botão só de ícone. Sempre passe aria-label; o title vira a dica visível. */
export const IconButton: React.FC<IconButtonProps> = ({
  variant = 'ghost',
  size = 'md',
  active = false,
  children,
  className,
  ...rest
}) => {
  const classes = [
    'ml-icon-btn',
    variant !== 'ghost' ? `ml-icon-btn--${variant}` : '',
    size !== 'md' ? `ml-icon-btn--${size}` : '',
    active ? 'is-active' : '',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
};
