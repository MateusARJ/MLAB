import React, { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mlab-theme';

function readStoredTheme(): Theme | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Aplica no <html> o tema salvo pelo usuário (ou o do sistema). Chamado uma vez ao carregar @mlab/ui. */
export function initTheme(): Theme {
  const theme = readStoredTheme() || systemTheme();
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
  return theme;
}

/** Tema atual e função para alternar. A escolha fica salva neste dispositivo. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* sem armazenamento: o tema vale só para esta sessão */
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}

/** Botão de sol/lua para trocar entre tema claro e escuro. */
export const ThemeToggle: React.FC<{ style?: React.CSSProperties; className?: string }> = ({ style, className }) => {
  const [theme, toggle] = useTheme();
  const label = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
  return (
    <button
      type="button"
      className={`ml-icon-btn${className ? ` ${className}` : ''}`}
      onClick={toggle}
      aria-label={label}
      title={label}
      style={style}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
};
