/**
 * MLab Design System 2.0 — Tokens
 *
 * Os valores reais vivem em styles/tokens.css (CSS custom properties), para que os temas
 * claro/escuro funcionem sem re-renderizar o React. Este arquivo mantém os nomes usados
 * pelas telas (colors.*, radii.*, typography.*) apontando para as variáveis CSS.
 *
 * Regra: não usar hexadecimal em componente. Faltou um token? Crie em tokens.css.
 * Atenção: estes valores são var(--…); não servem para <canvas> nem para concatenar alfa.
 */
export const colors = {
  // Ação (azul MLab)
  primary: 'var(--accent-fill)',
  primaryHover: 'var(--accent-fill-hover)',
  primaryActive: 'var(--accent-fill-hover)',
  accent: 'var(--accent)',
  primarySoft: 'var(--accent-soft)',
  onPrimary: 'var(--on-accent)',

  // Destrutivo / erro
  danger: 'var(--danger)',
  dangerFill: 'var(--danger-fill)',
  dangerHover: 'var(--danger-fill)',
  dangerSoft: 'var(--danger-soft)',
  dangerText: 'var(--danger)',

  // Estados
  success: 'var(--live)',
  successSoft: 'var(--live-soft)',
  warning: 'var(--attention)',
  warningSoft: 'var(--attention-soft)',
  warningText: 'var(--attention)',
  /** Preenchimento de destaque (posição na fila, mão levantada): o mesmo azul das ações. */
  attentionFill: 'var(--accent-fill)',
  onAttention: 'var(--on-attention)',
  rec: 'var(--rec)',

  // Superfícies
  bgBase: 'var(--bg)',
  surfaceCard: 'var(--surface-1)',
  surfaceCardSolid: 'var(--surface-1)',
  surfaceInput: 'var(--surface-1)',
  surfaceHover: 'var(--surface-2)',
  surfaceFloat: 'var(--surface-float)',
  stage: 'var(--stage)',

  // Bordas
  borderSubtle: 'var(--border-subtle)',
  borderStrong: 'var(--border-strong)',
  borderInteractive: 'var(--border-strong)',
  focusRing: 'var(--focus)',

  // Texto
  textPrimary: 'var(--text-1)',
  textSecondary: 'var(--text-2)',
  textMuted: 'var(--text-3)',
} as const;

export const radii = {
  sm: 'var(--r-control)',
  md: 'var(--r-control)',
  lg: 'var(--r-panel)',
  full: 'var(--r-pill)',
} as const;

export const typography = {
  fontFamily: 'var(--font-ui)',
  fontMono: 'var(--font-mono)',
  headingDisplay: { fontSize: 'var(--fs-title)', fontWeight: '700', lineHeight: '1.2' },
  headingCard: { fontSize: 'var(--fs-lead)', fontWeight: '700', lineHeight: '1.2' },
  headingSection: { fontSize: 'var(--fs-body)', fontWeight: '700', lineHeight: '1.4' },
  bodyStandard: { fontSize: 'var(--fs-body)', fontWeight: '400', lineHeight: '1.55' },
  bodyMedium: { fontSize: 'var(--fs-small)', fontWeight: '600', lineHeight: '1.4' },
  bodyLabel: { fontSize: 'var(--fs-small)', fontWeight: '600', lineHeight: '1.4' },
  caption: { fontSize: 'var(--fs-caption)', fontWeight: '400', lineHeight: '1.4' },
} as const;
