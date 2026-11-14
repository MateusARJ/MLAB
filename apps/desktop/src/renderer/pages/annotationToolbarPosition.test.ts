import { describe, expect, it } from 'vitest';
import { clampAnnotationToolbarPosition } from './annotationToolbarPosition';

// Barra de marcação interna dentro da prévia (028, RF-2815, issue #89).
describe('clampAnnotationToolbarPosition (028)', () => {
  const toolbar = { width: 48, height: 453 };

  it('mantém a posição quando a barra cabe inteira', () => {
    expect(clampAnnotationToolbarPosition({ x: 100, y: 120 }, { width: 1200, height: 821 }, toolbar)).toEqual({
      x: 100,
      y: 120,
    });
  });

  it('limita pela altura real da barra, não por um valor fixo (caso 1366x768 da #89)', () => {
    // prévia de 481 px e barra de 453 px: o topo só pode ir até 481 - 453 - 8 = 20
    expect(clampAnnotationToolbarPosition({ x: 12, y: 400 }, { width: 900, height: 481 }, toolbar)).toEqual({
      x: 12,
      y: 20,
    });
  });

  it('limita pela largura real da barra', () => {
    expect(clampAnnotationToolbarPosition({ x: 2000, y: 20 }, { width: 900, height: 821 }, toolbar)).toEqual({
      x: 900 - 48 - 8,
      y: 20,
    });
  });

  it('não deixa passar da margem de cima nem da esquerda', () => {
    expect(clampAnnotationToolbarPosition({ x: -50, y: -50 }, { width: 900, height: 821 }, toolbar)).toEqual({
      x: 8,
      y: 8,
    });
  });

  it('encosta na margem de cima quando a prévia é mais baixa que a barra (caso 1280x720 da #89)', () => {
    expect(clampAnnotationToolbarPosition({ x: 12, y: 200 }, { width: 900, height: 433 }, toolbar)).toEqual({
      x: 12,
      y: 8,
    });
  });

  it('volta para dentro quando a prévia diminui depois do arraste', () => {
    const arrastada = clampAnnotationToolbarPosition({ x: 700, y: 300 }, { width: 1200, height: 821 }, toolbar);
    expect(arrastada).toEqual({ x: 700, y: 300 });
    expect(clampAnnotationToolbarPosition(arrastada, { width: 600, height: 500 }, toolbar)).toEqual({
      x: 600 - 48 - 8,
      y: 500 - 453 - 8,
    });
  });

  it('arredonda para pixel inteiro', () => {
    expect(clampAnnotationToolbarPosition({ x: 10.6, y: 30.2 }, { width: 900, height: 821 }, toolbar)).toEqual({
      x: 11,
      y: 30,
    });
  });
});
