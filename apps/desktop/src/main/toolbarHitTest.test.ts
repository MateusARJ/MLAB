import { describe, it, expect } from 'vitest';
import {
  isPointerOverToolbar,
  resolveIgnoreMouse,
  sanitizeToolbarRect,
  TOOLBAR_HIT_MARGIN,
  resolveInputRegion,
  toDevicePixels,
} from './toolbarHitTest';

const rect = { x: 100, y: 20, width: 440, height: 54 };
const origin = { x: 0, y: 0 };

describe('isPointerOverToolbar (009/RF-901)', () => {
  it('detecta o ponteiro dentro da barra', () => {
    expect(isPointerOverToolbar({ x: 300, y: 40 }, origin, rect)).toBe(true);
  });

  it('ignora o ponteiro fora da barra', () => {
    expect(isPointerOverToolbar({ x: 700, y: 40 }, origin, rect)).toBe(false);
    expect(isPointerOverToolbar({ x: 300, y: 200 }, origin, rect)).toBe(false);
  });

  it('aplica a folga na borda', () => {
    expect(isPointerOverToolbar({ x: 100 - TOOLBAR_HIT_MARGIN, y: 40 }, origin, rect)).toBe(true);
    expect(isPointerOverToolbar({ x: 100 - TOOLBAR_HIT_MARGIN - 1, y: 40 }, origin, rect)).toBe(false);
    expect(isPointerOverToolbar({ x: 540 + TOOLBAR_HIT_MARGIN, y: 74 + TOOLBAR_HIT_MARGIN }, origin, rect)).toBe(true);
  });

  it('soma a posição do overlay (monitor secundário)', () => {
    const second = { x: 1920, y: 0 };
    expect(isPointerOverToolbar({ x: 300, y: 40 }, second, rect)).toBe(false);
    expect(isPointerOverToolbar({ x: 1920 + 300, y: 40 }, second, rect)).toBe(true);
  });

  it('barra recolhida usa o retângulo menor', () => {
    const collapsed = { x: 100, y: 20, width: 52, height: 52 };
    expect(isPointerOverToolbar({ x: 300, y: 40 }, origin, collapsed)).toBe(false);
    expect(isPointerOverToolbar({ x: 120, y: 40 }, origin, collapsed)).toBe(true);
  });

  it('retângulo nulo nunca é atingido', () => {
    expect(isPointerOverToolbar({ x: 300, y: 40 }, origin, null)).toBe(false);
  });
});

describe('resolveIgnoreMouse', () => {
  it('sai do click-through só com o ponteiro sobre a barra', () => {
    expect(resolveIgnoreMouse(true, false)).toBe(true);
    expect(resolveIgnoreMouse(true, true)).toBe(false);
  });

  it('ferramenta de desenho (renderer pede captura) continua capturando', () => {
    expect(resolveIgnoreMouse(false, false)).toBe(false);
    expect(resolveIgnoreMouse(false, true)).toBe(false);
  });
});

describe('sanitizeToolbarRect', () => {
  it('aceita um retângulo válido', () => {
    expect(sanitizeToolbarRect({ ...rect, extra: 1 }, 1920, 1080)).toEqual(rect);
  });

  it('rejeita valores não numéricos, não finitos, vazios ou fora do limite', () => {
    expect(sanitizeToolbarRect(null, 1920, 1080)).toBeNull();
    expect(sanitizeToolbarRect('x', 1920, 1080)).toBeNull();
    expect(sanitizeToolbarRect({ ...rect, x: '1' }, 1920, 1080)).toBeNull();
    expect(sanitizeToolbarRect({ ...rect, y: Number.NaN }, 1920, 1080)).toBeNull();
    expect(sanitizeToolbarRect({ ...rect, width: Infinity }, 1920, 1080)).toBeNull();
    expect(sanitizeToolbarRect({ ...rect, width: 0 }, 1920, 1080)).toBeNull();
    expect(sanitizeToolbarRect({ ...rect, height: -5 }, 1920, 1080)).toBeNull();
    expect(sanitizeToolbarRect({ ...rect, width: 5000 }, 1920, 1080)).toBeNull();
    expect(sanitizeToolbarRect({ ...rect, x: 99999 }, 1920, 1080)).toBeNull();
  });
});

describe('resolveInputRegion (009/RF-901, C-904)', () => {
  const size = { width: 1365, height: 767 };

  it('cobre a tela inteira quando o renderer pede captura do mouse', () => {
    expect(resolveInputRegion(false, rect, size)).toEqual([{ x: 0, y: 0, width: 1365, height: 767 }]);
    expect(resolveInputRegion(false, null, size)).toEqual([{ x: 0, y: 0, width: 1365, height: 767 }]);
  });

  it('recorta só a barra quando o renderer pede click-through', () => {
    expect(resolveInputRegion(true, rect, size)).toEqual([rect]);
  });

  it('fica vazia com click-through e retângulo nulo (C-903)', () => {
    expect(resolveInputRegion(true, null, size)).toEqual([]);
  });

  it('não cria região com tamanho de overlay inválido', () => {
    expect(resolveInputRegion(false, rect, { width: 0, height: 767 })).toEqual([]);
  });
});

describe('toDevicePixels (009/C-904)', () => {
  it('multiplica pela escala e arredonda para fora', () => {
    expect(toDevicePixels([{ x: 10.4, y: 20.6, width: 100.2, height: 50.5 }], 1.5)).toEqual([
      { x: 15, y: 30, width: 151, height: 77 },
    ]);
  });

  it('usa escala 1 quando a escala é inválida', () => {
    expect(toDevicePixels([rect], 0)).toEqual([rect]);
    expect(toDevicePixels([rect], Number.NaN)).toEqual([rect]);
  });
});
