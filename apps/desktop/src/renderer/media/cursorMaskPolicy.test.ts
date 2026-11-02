import { describe, it, expect } from 'vitest';
import type { AnnotationOverlayState, CursorState } from '@mlab/types';
import { decideFramePath, shouldMaskCursor } from './cursorMaskPolicy';

const RECT = { x: 0.4, y: 0.4, w: 0.03, h: 0.05 };

function annotations(overrides: Partial<AnnotationOverlayState> = {}): AnnotationOverlayState {
  return {
    strokes: [],
    activeStroke: null,
    spotlight: { enabled: false, x: 0.5, y: 0.5, radius: 0.14, zoom: 1, activeInViewer: false },
    captureMode: 'window',
    externalOverlayActive: false,
    ...overrides,
  };
}

const STROKE = { id: 's1', tool: 'pen', color: '#f00', size: 4, points: [{ x: 0.1, y: 0.1 }] } as any;

describe('cursorMaskPolicy', () => {
  it('repassa sem composição quando o cursor está visível e não há anotação (RF-702)', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    expect(decideFramePath(cursor, annotations(), false)).toEqual({
      compose: false,
      maskCursor: false,
      drawAnnotations: false,
    });
  });

  it('repassa sem composição quando o cursor está oculto mas fora da fonte (rect nulo)', () => {
    const cursor: CursorState = { visible: false, rect: null };
    expect(decideFramePath(cursor, annotations(), false).compose).toBe(false);
  });

  it('não mascara retângulo sem área', () => {
    expect(shouldMaskCursor({ visible: false, rect: { x: 0.5, y: 0.5, w: 0, h: 0.02 } })).toBe(false);
  });

  it('compõe e mascara quando o cursor está oculto dentro da fonte (RF-701)', () => {
    const cursor: CursorState = { visible: false, rect: RECT };
    expect(decideFramePath(cursor, annotations(), false)).toEqual({
      compose: true,
      maskCursor: true,
      drawAnnotations: false,
    });
  });

  it('não mascara quando a máscara está suspensa pela proteção de FPS (RF-703)', () => {
    const cursor: CursorState = { visible: false, rect: RECT };
    expect(decideFramePath(cursor, annotations(), true).compose).toBe(false);
  });

  it('suspensão da máscara não afeta as anotações (C-701)', () => {
    const cursor: CursorState = { visible: false, rect: RECT };
    expect(decideFramePath(cursor, annotations({ strokes: [STROKE] }), true)).toEqual({
      compose: true,
      maskCursor: false,
      drawAnnotations: true,
    });
  });

  it('desenha anotações no worker no modo janela', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    expect(decideFramePath(cursor, annotations({ strokes: [STROKE] }), false)).toEqual({
      compose: true,
      maskCursor: false,
      drawAnnotations: true,
    });
  });

  it('não desenha anotações no worker quando a tela cheia já as captura nativamente', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    const ann = annotations({ strokes: [STROKE], captureMode: 'screen', externalOverlayActive: true });
    expect(decideFramePath(cursor, ann, false).drawAnnotations).toBe(false);
  });

  it('desenha a Lupa com ampliação no worker mesmo na tela cheia com overlay', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    const ann = annotations({
      captureMode: 'screen',
      externalOverlayActive: true,
      spotlight: { enabled: true, x: 0.5, y: 0.5, radius: 0.14, zoom: 2, activeInViewer: false },
    });
    expect(decideFramePath(cursor, ann, false).drawAnnotations).toBe(true);
  });
});
