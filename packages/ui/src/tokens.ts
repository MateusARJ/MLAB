/**
 * MLab Design System — Tokens (Carbon Aligned)
 */
export const colors = {
  // Brand Blue
  primary: '#0284c7',
  primaryHover: '#0369a1',
  primaryActive: '#075985',
  accent: '#38bdf8',
  primarySoft: 'rgba(2, 132, 199, 0.15)',

  // Danger Red
  danger: '#ef4444',
  dangerHover: '#dc2626',
  dangerSoft: 'rgba(239, 68, 68, 0.15)',
  dangerText: '#fca5a5',

  // Semantic Status
  success: '#16a34a',
  successSoft: 'rgba(22, 163, 74, 0.15)',
  warning: '#eab308',
  warningSoft: 'rgba(234, 179, 8, 0.15)',
  warningText: '#fde047',

  // Surfaces & Backgrounds
  bgBase: '#0f172a',
  surfaceCard: 'rgba(30, 41, 59, 0.85)',
  surfaceCardSolid: '#1e293b',
  surfaceInput: '#0f172a',
  surfaceHover: '#334155',

  // Borders & Dividers
  borderSubtle: 'rgba(255, 255, 255, 0.1)',
  borderStrong: '#334155',
  borderInteractive: '#475569',
  focusRing: '#38bdf8',

  // Typography Colors
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
} as const;

export const radii = {
  sm: '4px',
  md: '8px',
  lg: '16px',
  full: '9999px',
} as const;

export const typography = {
  fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headingDisplay: { fontSize: '24px', fontWeight: '700', lineHeight: '32px' },
  headingCard: { fontSize: '20px', fontWeight: '700', lineHeight: '28px' },
  headingSection: { fontSize: '16px', fontWeight: '600', lineHeight: '24px' },
  bodyStandard: { fontSize: '14px', fontWeight: '400', lineHeight: '20px' },
  bodyMedium: { fontSize: '14px', fontWeight: '500', lineHeight: '20px' },
  bodyLabel: { fontSize: '13px', fontWeight: '500', lineHeight: '18px' },
  caption: { fontSize: '12px', fontWeight: '400', lineHeight: '16px' },
} as const;
