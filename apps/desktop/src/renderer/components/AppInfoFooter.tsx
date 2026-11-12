import React, { useEffect, useId, useRef, useState } from 'react';
import { Button, colors, radii, typography } from '@mlab/ui';
import { useAppInfo } from '../hooks/useAppInfo';

/**
 * Rodapé com a versão do MLab e o diálogo "Sobre" (021, RF-2101 a RF-2103, RF-2107).
 * Sem informações do main, nada é renderizado.
 */
export const AppInfoFooter: React.FC = () => {
  const info = useAppInfo();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!info) return null;

  return (
    <>
      <footer style={styles.footer}>
        <span>{`${info.name} v${info.version}`}</span>
        <span aria-hidden="true" style={styles.separator}>
          ·
        </span>
        <button type="button" style={styles.link} onClick={() => setOpen(true)}>
          Sobre
        </button>
      </footer>

      {open && (
        <div style={styles.backdrop} onClick={() => setOpen(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={styles.dialog}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} style={styles.title}>
              {info.name}
            </h2>
            <p style={styles.version}>{`Versão ${info.version}`}</p>
            <p style={styles.description}>{info.description}</p>
            <p style={styles.copyright}>{info.copyright}</p>
            <Button variant="secondary" size="md" fullWidth onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    fontFamily: typography.fontFamily,
    fontSize: typography.caption.fontSize,
    color: colors.textMuted,
  },
  separator: {
    color: colors.borderInteractive,
  },
  link: {
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    color: colors.accent,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 1000,
    padding: '20px',
  },
  dialog: {
    width: '100%',
    maxWidth: '380px',
    backgroundColor: colors.surfaceCardSolid,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: radii.lg,
    padding: '28px 24px',
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  title: {
    ...typography.headingDisplay,
    color: colors.accent,
    margin: '0 0 4px 0',
  },
  version: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    margin: '0 0 16px 0',
  },
  description: {
    ...typography.bodyStandard,
    color: colors.textPrimary,
    margin: '0 0 16px 0',
  },
  copyright: {
    ...typography.caption,
    color: colors.textMuted,
    margin: '0 0 24px 0',
  },
};
