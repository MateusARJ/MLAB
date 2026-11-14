import React from 'react';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

/** Campo de texto com rótulo sempre visível, dica e erro ligados por aria-describedby. */
export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(({
  label,
  helperText,
  error,
  icon,
  rightElement,
  id,
  className,
  ...rest
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const noteId = inputId && (error || helperText) ? `${inputId}-note` : undefined;

  return (
    <div className="ml-field">
      {label && (
        <label htmlFor={inputId} className="ml-label">
          {label}
        </label>
      )}

      <div className={`ml-inputwrap${error ? ' is-invalid' : ''}${rest.readOnly ? ' is-readonly' : ''}`}>
        {icon && <span className="ml-inputwrap__icon">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`ml-inputwrap__input${className ? ` ${className}` : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={noteId}
          {...rest}
        />
        {rightElement && <span className="ml-inputwrap__right">{rightElement}</span>}
      </div>

      {error ? (
        <span id={noteId} className="ml-error">{error}</span>
      ) : helperText ? (
        <span id={noteId} className="ml-hint">{helperText}</span>
      ) : null}
    </div>
  );
});

TextInput.displayName = 'TextInput';
