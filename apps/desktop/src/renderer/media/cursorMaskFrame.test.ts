import { describe, expect, it } from 'vitest';
import {
  copyAllExcept,
  copyRect,
  fillFromNeighborhood,
  frameGeometry,
  planeSpecs,
  toPixelRect,
  type FrameGeometry,
} from './cursorMaskFrame';

/** Layout compacto (stride = largura do plano) para um formato e resolução. */
function packedLayout(format: string, width: number, height: number) {
  const specs = planeSpecs(format)!;
  let offset = 0;
  return specs.map((s) => {
    const stride = Math.ceil(width / s.sx) * s.bps;
    const plane = { offset, stride };
    offset += stride * Math.ceil(height / s.sy);
    return plane;
  });
}

function makeFrame(format: string, width: number, height: number, fill: number) {
  const layout = packedLayout(format, width, height);
  const geom = frameGeometry(format, width, height, layout)!;
  const last = geom.planes[geom.planes.length - 1];
  const buf = new Uint8Array(last.offset + last.stride * last.rows).fill(fill);
  return { geom, buf };
}

function at(buf: Uint8Array, geom: FrameGeometry, plane: number, row: number, byte: number) {
  const p = geom.planes[plane];
  return buf[p.offset + row * p.stride + byte];
}

describe('planeSpecs / frameGeometry', () => {
  it('descreve os planos dos formatos mapeáveis e recusa os demais', () => {
    expect(planeSpecs('I420')).toHaveLength(3);
    expect(planeSpecs('NV12')).toEqual([
      { sx: 1, sy: 1, bps: 1 },
      { sx: 2, sy: 2, bps: 2 },
    ]);
    expect(planeSpecs('BGRA')).toEqual([{ sx: 1, sy: 1, bps: 4 }]);
    expect(planeSpecs(null)).toBeNull();
    expect(planeSpecs('P010')).toBeNull();
  });

  it('arredonda os planos subamostrados para cima em dimensões ímpares', () => {
    const g = frameGeometry('I420', 5, 3, packedLayout('I420', 5, 3))!;
    expect(g.planes.map((p) => [p.cols, p.rows])).toEqual([
      [5, 3],
      [3, 2],
      [3, 2],
    ]);
  });

  it('recusa layout com número de planos diferente do formato', () => {
    expect(frameGeometry('I420', 4, 4, [{ offset: 0, stride: 4 }])).toBeNull();
  });
});

describe('toPixelRect', () => {
  it('converte e limita ao quadro', () => {
    expect(toPixelRect({ x: 0.5, y: 0.5, w: 0.25, h: 0.25 }, 100, 80)).toEqual({ x: 50, y: 40, w: 25, h: 20 });
    expect(toPixelRect({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, 100, 100)).toEqual({ x: 90, y: 90, w: 10, h: 10 });
  });
});

describe('copyRect', () => {
  it('copia só o retângulo em todos os planos do I420', () => {
    const plate = makeFrame('I420', 8, 8, 7);
    const frame = makeFrame('I420', 8, 8, 200);
    copyRect(plate.buf, frame.buf, frame.geom, { x: 2, y: 2, w: 4, h: 4 });
    expect(at(frame.buf, frame.geom, 0, 2, 2)).toBe(7);
    expect(at(frame.buf, frame.geom, 0, 5, 5)).toBe(7);
    expect(at(frame.buf, frame.geom, 0, 1, 2)).toBe(200);
    expect(at(frame.buf, frame.geom, 0, 2, 6)).toBe(200);
    // Croma: pixels 2..5 → amostras 1..2.
    expect(at(frame.buf, frame.geom, 1, 1, 1)).toBe(7);
    expect(at(frame.buf, frame.geom, 2, 2, 2)).toBe(7);
    expect(at(frame.buf, frame.geom, 1, 0, 1)).toBe(200);
    expect(at(frame.buf, frame.geom, 1, 1, 3)).toBe(200);
  });

  it('arredonda para fora na croma quando o retângulo começa em pixel ímpar (NV12)', () => {
    const plate = makeFrame('NV12', 8, 8, 9);
    const frame = makeFrame('NV12', 8, 8, 100);
    copyRect(plate.buf, frame.buf, frame.geom, { x: 3, y: 3, w: 2, h: 2 });
    // Pixels 3..4 → amostras de croma 1..2 → bytes 2..5 (UV intercalado).
    expect(at(frame.buf, frame.geom, 1, 1, 2)).toBe(9);
    expect(at(frame.buf, frame.geom, 1, 2, 5)).toBe(9);
    expect(at(frame.buf, frame.geom, 1, 1, 1)).toBe(100);
    expect(at(frame.buf, frame.geom, 1, 1, 6)).toBe(100);
  });

  it('respeita stride maior que a largura do plano', () => {
    const layout = [{ offset: 0, stride: 16 }];
    const geom = frameGeometry('RGBA', 3, 2, layout)!;
    const src = new Uint8Array(32).fill(1);
    const dst = new Uint8Array(32).fill(0);
    copyRect(src, dst, geom, { x: 1, y: 1, w: 1, h: 1 });
    expect(Array.from(dst.subarray(16 + 4, 16 + 8))).toEqual([1, 1, 1, 1]);
    expect(dst[16]).toBe(0);
    expect(dst[16 + 8]).toBe(0);
    expect(dst[12]).toBe(0);
  });
});

describe('copyAllExcept', () => {
  it('atualiza tudo menos o retângulo preservado', () => {
    const frame = makeFrame('I420', 8, 8, 50);
    const plate = makeFrame('I420', 8, 8, 1);
    copyAllExcept(frame.buf, plate.buf, plate.geom, { x: 4, y: 4, w: 2, h: 2 });
    expect(at(plate.buf, plate.geom, 0, 4, 4)).toBe(1);
    expect(at(plate.buf, plate.geom, 0, 5, 5)).toBe(1);
    expect(at(plate.buf, plate.geom, 0, 4, 3)).toBe(50);
    expect(at(plate.buf, plate.geom, 0, 4, 6)).toBe(50);
    expect(at(plate.buf, plate.geom, 0, 3, 4)).toBe(50);
    expect(at(plate.buf, plate.geom, 0, 6, 4)).toBe(50);
    expect(at(plate.buf, plate.geom, 1, 2, 2)).toBe(1);
    expect(at(plate.buf, plate.geom, 1, 2, 1)).toBe(50);
  });

  it('copia o quadro inteiro sem retângulo preservado', () => {
    const frame = makeFrame('NV12', 6, 4, 33);
    const plate = makeFrame('NV12', 6, 4, 0);
    copyAllExcept(frame.buf, plate.buf, plate.geom, null);
    expect(Array.from(plate.buf).every((v) => v === 33)).toBe(true);
  });

  it('não copia o preenchimento de stride fora da área útil', () => {
    const geom = frameGeometry('RGBA', 2, 2, [{ offset: 0, stride: 12 }])!;
    const src = new Uint8Array(24).fill(5);
    const dst = new Uint8Array(24).fill(0);
    copyAllExcept(src, dst, geom, null);
    expect(dst[7]).toBe(5);
    expect(dst[8]).toBe(0);
    expect(dst[12 + 7]).toBe(5);
  });
});

describe('fillFromNeighborhood', () => {
  it('interpola entre as linhas acima e abaixo', () => {
    const { geom, buf } = makeFrame('I420', 4, 10, 0);
    const y = geom.planes[0];
    for (let r = 0; r < 10; r++) buf.fill(r < 5 ? 0 : 200, y.offset + r * y.stride, y.offset + (r + 1) * y.stride);
    // Área nas linhas 3..6; acima (0..2) = 0, abaixo (7..9) = 200.
    fillFromNeighborhood(buf, geom, { x: 0, y: 3, w: 4, h: 4 });
    const col = [3, 4, 5, 6].map((r) => at(buf, geom, 0, r, 1));
    expect(col).toEqual([40, 80, 120, 160]);
    expect(at(buf, geom, 0, 2, 1)).toBe(0);
    expect(at(buf, geom, 0, 7, 1)).toBe(200);
  });

  it('usa só as linhas de baixo quando a área encosta no topo', () => {
    const { geom, buf } = makeFrame('RGBA', 2, 6, 90);
    fillFromNeighborhood(buf, geom, { x: 0, y: 0, w: 2, h: 3 });
    expect(at(buf, geom, 0, 0, 0)).toBe(90);
    expect(at(buf, geom, 0, 2, 7)).toBe(90);
  });

  it('não altera nada quando a área cobre o quadro inteiro', () => {
    const { geom, buf } = makeFrame('I420', 4, 4, 77);
    fillFromNeighborhood(buf, geom, { x: 0, y: 0, w: 4, h: 4 });
    expect(Array.from(buf).every((v) => v === 77)).toBe(true);
  });
});
