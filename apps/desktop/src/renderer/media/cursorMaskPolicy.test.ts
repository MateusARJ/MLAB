import { describe, it, expect } from 'vitest';
import type { AnnotationOverlayState, CursorState } from '@mlab/types';
import { decideFramePath, FrameBudgetGuard, shouldMaskCursor } from './cursorMaskPolicy';

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

describe('FrameBudgetGuard', () => {
  function makeClock() {
    let t = 0;
    return { now: () => t, advance: (ms: number) => (t += ms) };
  }

  it('não suspende antes do mínimo de amostras nem dentro do orçamento', () => {
    const clock = makeClock();
    const guard = new FrameBudgetGuard(clock.now);
    for (let i = 0; i < 9; i++) expect(guard.record(20)).toBeNull();
    const ok = new FrameBudgetGuard(clock.now);
    for (let i = 0; i < 50; i++) expect(ok.record(5)).toBeNull();
    expect(ok.isSuspended).toBe(false);
  });

  it('suspende com média acima de 8 ms após 10 amostras e retoma após a espera (RF-703)', () => {
    const clock = makeClock();
    const guard = new FrameBudgetGuard(clock.now);
    let ev = null;
    for (let i = 0; i < 10; i++) ev = guard.record(12);
    expect(ev).toEqual({ type: 'mask-suspended', avgMs: 12, retryInMs: 5000 });
    expect(guard.isSuspended).toBe(true);
    expect(guard.record(50)).toBeNull();

    clock.advance(4999);
    expect(guard.poll()).toBeNull();
    clock.advance(1);
    expect(guard.poll()).toEqual({ type: 'mask-resumed' });
    expect(guard.isSuspended).toBe(false);
  });

  it('dobra a espera a cada suspensão até 60 s e zera a média ao retomar', () => {
    const clock = makeClock();
    const guard = new FrameBudgetGuard(clock.now);
    const waits: number[] = [];
    for (let round = 0; round < 6; round++) {
      let ev: any = null;
      for (let i = 0; i < 10 && !ev; i++) ev = guard.record(15);
      expect(ev?.type).toBe('mask-suspended');
      waits.push(ev.retryInMs);
      clock.advance(ev.retryInMs);
      expect(guard.poll()).toEqual({ type: 'mask-resumed' });
      // média zerada: 9 amostras novas não bastam para suspender de novo
      for (let i = 0; i < 9; i++) expect(guard.record(15)).toBeNull();
    }
    expect(waits).toEqual([5000, 10000, 20000, 40000, 60000, 60000]);
  });
});
