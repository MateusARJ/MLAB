/// <reference path="./assets.d.ts" />
import React from 'react';
import mlabLogoMark from './assets/mlab-logo-mark.png';

export interface BrandMarkProps {
  /** Altura do símbolo em px. A largura acompanha a proporção da imagem. */
  size?: number;
  /** Nome acessível. Sem título, o símbolo é decorativo (o nome "MLab" já aparece em texto ao lado). */
  title?: string;
  style?: React.CSSProperties;
}

/**
 * Símbolo do MLab (notebook transmitindo para a turma), sem o nome escrito.
 * Fundo transparente: funciona nos temas claro e escuro.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 28, title, style }) => (
  <img
    src={mlabLogoMark}
    alt={title || ''}
    aria-hidden={title ? undefined : true}
    draggable={false}
    style={{ height: `${size}px`, width: 'auto', flex: 'none', display: 'block', ...style }}
  />
);
