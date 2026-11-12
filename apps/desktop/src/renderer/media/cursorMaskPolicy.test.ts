import { describe, it, expect } from 'vitest';
import type { AnnotationOverlayState, CursorState } from '@mlab/types';
import {
  CursorTrail,
  decideFramePath,
  FrameBudgetGuard,
  shouldDrawSpotlight,
  shouldMaskCursor,
  unionRect,
} from './cursorMaskPolicy';

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

/** Retângulo a apagar para um único estado do cursor (sem rastro anterior). */
function maskOf(cursor: CursorState) {
  const trail = new CursorTrail();
  trail.push(cursor, 0);
  return trail.maskRect(0);
}

const STROKE = { id: 's1', tool: 'pen', color: '#f00', size: 4, points: [{ x: 0.1, y: 0.1 }] } as any;

describe('cursorMaskPolicy', () => {
  it('repassa sem composição quando o cursor está visível e não há anotação (RF-702)', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    expect(decideFramePath(maskOf(cursor), annotations(), false, cursor)).toEqual({
      compose: false,
      maskCursor: false,
      drawAnnotations: false,
      drawSpotlight: false,
    });
  });

  it('repassa sem composição quando o cursor está oculto mas fora da fonte (rect nulo)', () => {
    const cursor: CursorState = { visible: false, rect: null };
    expect(decideFramePath(maskOf(cursor), annotations(), false, cursor).compose).toBe(false);
  });

  it('não mascara retângulo sem área', () => {
    expect(shouldMaskCursor({ visible: false, rect: { x: 0.5, y: 0.5, w: 0, h: 0.02 } })).toBe(false);
  });

  it('compõe e mascara quando o cursor está oculto dentro da fonte (RF-701)', () => {
    const cursor: CursorState = { visible: false, rect: RECT };
    expect(decideFramePath(maskOf(cursor), annotations(), false, cursor)).toEqual({
      compose: true,
      maskCursor: true,
      drawAnnotations: false,
      drawSpotlight: false,
    });
  });

  it('não mascara quando a máscara está suspensa pela proteção de FPS (RF-703)', () => {
    const cursor: CursorState = { visible: false, rect: RECT };
    expect(decideFramePath(maskOf(cursor), annotations(), true, cursor).compose).toBe(false);
  });

  it('suspensão da máscara não afeta as anotações (C-701)', () => {
    const cursor: CursorState = { visible: false, rect: RECT };
    expect(decideFramePath(maskOf(cursor), annotations({ strokes: [STROKE] }), true, cursor)).toEqual({
      compose: true,
      maskCursor: false,
      drawAnnotations: true,
      drawSpotlight: false,
    });
  });

  it('desenha anotações no worker no modo janela', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    expect(decideFramePath(maskOf(cursor), annotations({ strokes: [STROKE] }), false, cursor)).toEqual({
      compose: true,
      maskCursor: false,
      drawAnnotations: true,
      drawSpotlight: false,
    });
  });

  it('não desenha anotações no worker quando a tela cheia já as captura nativamente', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    const ann = annotations({ strokes: [STROKE], captureMode: 'screen', externalOverlayActive: true });
    expect(decideFramePath(maskOf(cursor), ann, false, cursor).drawAnnotations).toBe(false);
  });

  it('desenha a Lupa com ampliação no worker mesmo na tela cheia com overlay', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    const ann = annotations({
      captureMode: 'screen',
      externalOverlayActive: true,
      spotlight: { enabled: true, x: 0.5, y: 0.5, radius: 0.14, zoom: 2, activeInViewer: false },
    });
    expect(decideFramePath(maskOf(cursor), ann, false, cursor).drawAnnotations).toBe(true);
  });
});

describe('Lupa no modo janela (RF-708, C-705)', () => {
  const lupa = (overrides: Partial<AnnotationOverlayState['spotlight']> = {}) => ({
    enabled: true,
    x: 0.5,
    y: 0.5,
    radius: 0.14,
    zoom: 1 as const,
    activeInViewer: false,
    ...overrides,
  });

  it('desenha a Lupa com a janela transmitida em foco e sob o ponteiro', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    expect(shouldDrawSpotlight(cursor, annotations({ spotlight: lupa() }))).toBe(true);
    expect(decideFramePath(maskOf(cursor), annotations({ spotlight: lupa() }), false, cursor)).toEqual({
      compose: true,
      maskCursor: false,
      drawAnnotations: true,
      drawSpotlight: true,
    });
  });

  it('não desenha a Lupa com outra janela em foco cobrindo a transmitida sob o ponteiro (issue #70)', () => {
    const cursor: CursorState = { visible: false, rect: RECT };
    expect(shouldDrawSpotlight(cursor, annotations({ spotlight: lupa({ zoom: 2 }) }))).toBe(false);
    expect(decideFramePath(maskOf(cursor), annotations({ spotlight: lupa() }), false, cursor)).toEqual({
      compose: true,
      maskCursor: true,
      drawAnnotations: false,
      drawSpotlight: false,
    });
  });

  it('repassa sem composição quando o ponteiro está fora da janela transmitida e só a Lupa está ligada', () => {
    const cursor: CursorState = { visible: false, rect: null };
    expect(decideFramePath(maskOf(cursor), annotations({ spotlight: lupa() }), false, cursor)).toEqual({
      compose: false,
      maskCursor: false,
      drawAnnotations: false,
      drawSpotlight: false,
    });
  });

  it('não desenha a Lupa com o cursor marcado visível mas fora da fonte', () => {
    const cursor: CursorState = { visible: true, rect: null };
    expect(shouldDrawSpotlight(cursor, annotations({ spotlight: lupa() }))).toBe(false);
  });

  it('desenha a Lupa posicionada no visualizador do MLab, mesmo com o cursor oculto', () => {
    const cursor: CursorState = { visible: false, rect: null };
    const ann = annotations({ spotlight: lupa({ activeInViewer: true }) });
    expect(shouldDrawSpotlight(cursor, ann)).toBe(true);
    expect(decideFramePath(maskOf(cursor), ann, false, cursor).drawSpotlight).toBe(true);
  });

  it('mantém os traços no vídeo e tira só a Lupa com o professor em outra janela', () => {
    const cursor: CursorState = { visible: false, rect: null };
    const ann = annotations({ strokes: [STROKE], spotlight: lupa() });
    expect(decideFramePath(maskOf(cursor), ann, false, cursor)).toEqual({
      compose: true,
      maskCursor: false,
      drawAnnotations: true,
      drawSpotlight: false,
    });
  });

  it('a suspensão da máscara não muda a regra da Lupa', () => {
    const cursor: CursorState = { visible: false, rect: RECT };
    expect(decideFramePath(maskOf(cursor), annotations({ spotlight: lupa() }), true, cursor).drawSpotlight).toBe(
      false
    );
  });

  it('Lupa desligada nunca é desenhada', () => {
    const cursor: CursorState = { visible: true, rect: RECT };
    expect(shouldDrawSpotlight(cursor, annotations({ spotlight: lupa({ enabled: false, activeInViewer: true }) }))).toBe(
      false
    );
  });

  it('fora do modo janela a regra não muda: Lupa ligada é desenhada mesmo com o cursor oculto', () => {
    const cursor: CursorState = { visible: false, rect: null };
    const ann = annotations({ captureMode: 'screen', externalOverlayActive: false, spotlight: lupa() });
    expect(shouldDrawSpotlight(cursor, ann)).toBe(true);
    expect(decideFramePath(maskOf(cursor), ann, false, cursor).drawSpotlight).toBe(true);
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

describe('CursorTrail (C-703)', () => {
  const A = { x: 0.1, y: 0.1, w: 0.02, h: 0.03 };
  const B = { x: 0.3, y: 0.2, w: 0.02, h: 0.03 };
  const C = { x: 0.5, y: 0.4, w: 0.02, h: 0.03 };

  it('une os retângulos ocultos recentes para cobrir o atraso do quadro no movimento rápido (RF-701)', () => {
    const trail = new CursorTrail(150);
    trail.push({ visible: false, rect: A }, 0);
    trail.push({ visible: false, rect: B }, 16);
    trail.push({ visible: false, rect: C }, 32);
    expect(trail.maskRect(40)).toEqual(unionRect(unionRect(A, B), C));
  });

  it('descarta estados que deixaram de valer antes da janela, mantendo o atual parado', () => {
    const trail = new CursorTrail(150);
    trail.push({ visible: false, rect: A }, 0);
    trail.push({ visible: false, rect: B }, 100);
    // A vigorou até 100 ms: ainda dentro da janela em 200 ms, fora em 251 ms.
    expect(trail.maskRect(200)).toEqual(unionRect(A, B));
    expect(trail.maskRect(251)).toEqual(B);
    // Cursor parado: o estado atual continua valendo indefinidamente.
    expect(trail.maskRect(10_000)).toEqual(B);
  });

  it('continua apagando o rastro oculto logo após o cursor voltar a ficar visível', () => {
    const trail = new CursorTrail(150);
    trail.push({ visible: false, rect: A }, 0);
    trail.push({ visible: true, rect: B }, 50);
    expect(trail.maskRect(120)).toEqual(A);
    expect(trail.anyRect(120)).toEqual(unionRect(A, B));
    expect(trail.maskRect(201)).toBeNull();
    expect(trail.anyRect(201)).toEqual(B);
  });

  it('não apaga nada com o cursor visível ou fora da fonte', () => {
    const trail = new CursorTrail(150);
    trail.push({ visible: true, rect: A }, 0);
    trail.push({ visible: false, rect: null }, 10);
    expect(trail.maskRect(20)).toBeNull();
    expect(trail.anyRect(200)).toBeNull();
  });
});
