import React, { useState } from 'react';
import { colors, radii, typography } from './tokens';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(({
  label,
  helperText,
  error,
  icon,
  rightElement,
  disabled,
  style,
  id,
  onFocus,
  onBlur,
  ...rest
}, ref) => {
  const [focused, setFocused] = useState(false);
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: error ? colors.dangerText : colors.textSecondary,
            fontFamily: typography.fontFamily,
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: colors.surfaceInput,
          border: `1px solid ${error ? colors.danger : (focused ? colors.focusRing : colors.borderStrong)}`,
          borderRadius: radii.md,
          boxShadow: focused ? `0 0 0 2px ${error ? colors.dangerSoft : colors.primarySoft}` : 'none',
          transition: 'all 0.15s ease-in-out',
          boxSizing: 'border-box',
        }}
      >
        {icon && (
          <span
            style={{
              paddingLeft: '12px',
              display: 'flex',
              alignItems: 'center',
              color: colors.textMuted,
            }}
          >
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '12px 14px',
            paddingLeft: icon ? '8px' : '14px',
            paddingRight: rightElement ? '8px' : '14px',
            backgroundColor: 'transparent',
            border: 'none',
            color: colors.textPrimary,
            fontSize: '14px',
            fontFamily: typography.fontFamily,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? 'not-allowed' : 'text',
            ...style,
          }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {rightElement && (
          <span
            style={{
              paddingRight: '10px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {rightElement}
          </span>
        )}
      </div>

      {error ? (
        <span style={{ fontSize: '12px', color: colors.dangerText, fontFamily: typography.fontFamily }}>
          {error}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: '12px', color: colors.textMuted, fontFamily: typography.fontFamily }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
});

TextInput.displayName = 'TextInput';
