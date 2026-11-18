import React from 'react';
import { Hand, Pin, type LucideProps } from 'lucide-react';

/** Mão levantada "ativa": mesmo desenho, com preenchimento suave. */
export const Touch_1Filled: React.FC<LucideProps> = (props) => (
  <Hand fill="currentColor" fillOpacity={0.28} strokeWidth={2.25} {...props} />
);

/** Mensagem fixada: alfinete preenchido. */
export const PinFilled: React.FC<LucideProps> = (props) => <Pin fill="currentColor" {...props} />;
