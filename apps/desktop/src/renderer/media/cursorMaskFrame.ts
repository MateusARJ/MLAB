/**
 * Máscara do cursor nos planos do próprio quadro, em memória (007, T708).
 *
 * O quadro capturado chega em memória (ex.: `I420`) e, no repasse, vai direto ao encoder. Compor no `OffscreenCanvas`
 * gera um quadro RGBA na GPU que o encoder precisa ler de volta e converter a cada quadro, e é isso que faz a
 * transmissão engasgar com a máscara ativa. Aqui a máscara é aplicada sobre uma cópia dos planos (`VideoFrame.copyTo`)
 * e o quadro de saída é criado no mesmo formato do capturado, sem passar pela GPU.
 *
 * Funções puras sobre `Uint8Array`, testáveis sem `VideoFrame`.
 */

import type { NormRect } from './cursorMaskPolicy';

/** Amostragem de um plano: `sx`/`sy` = subamostragem horizontal/vertical; `bps` = bytes por amostra. */
export interface PlaneSpec {
  sx: number;
  sy: number;
  bps: number;
}

export interface PlaneLayoutLike {
  offset: number;
  stride: number;
}

export interface PlaneGeometry extends PlaneSpec, PlaneLayoutLike {
  /** Largura do plano em amostras. */
  cols: number;
  /** Altura do plano em linhas. */
  rows: number;
}

export interface FrameGeometry {
  /** Largura e altura do quadro em pixels (resolução visível copiada). */
  width: number;
  height: number;
  planes: PlaneGeometry[];
}

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL_1: PlaneSpec = { sx: 1, sy: 1, bps: 1 };
const PACKED_4: PlaneSpec = { sx: 1, sy: 1, bps: 4 };

/** Planos dos formatos mapeáveis em memória; `null` para formatos que seguem pelo canvas. */
export function planeSpecs(format: string | null | undefined): PlaneSpec[] | null {
  switch (format) {
    case 'I420':
      return [FULL_1, { sx: 2, sy: 2, bps: 1 }, { sx: 2, sy: 2, bps: 1 }];
    case 'I420A':
      return [FULL_1, { sx: 2, sy: 2, bps: 1 }, { sx: 2, sy: 2, bps: 1 }, FULL_1];
    case 'I422':
      return [FULL_1, { sx: 2, sy: 1, bps: 1 }, { sx: 2, sy: 1, bps: 1 }];
    case 'I444':
      return [FULL_1, FULL_1, FULL_1];
    case 'NV12':
      return [FULL_1, { sx: 2, sy: 2, bps: 2 }];
    case 'RGBA':
    case 'RGBX':
    case 'BGRA':
    case 'BGRX':
      return [PACKED_4];
    default:
      return null;
  }
}

/** Geometria do buffer a partir do formato, da resolução copiada e do layout devolvido por `copyTo`. */
export function frameGeometry(
  format: string | null | undefined,
  width: number,
  height: number,
  layout: readonly PlaneLayoutLike[]
): FrameGeometry | null {
  const specs = planeSpecs(format);
  if (!specs || width <= 0 || height <= 0 || layout.length !== specs.length) return null;
  const planes = specs.map((spec, i) => ({
    ...spec,
    offset: layout[i].offset,
    stride: layout[i].stride,
    cols: Math.ceil(width / spec.sx),
    rows: Math.ceil(height / spec.sy),
  }));
  return { width, height, planes };
}

/** Retângulo normalizado → pixels inteiros dentro do quadro (mesma regra do canvas). */
export function toPixelRect(norm: NormRect, width: number, height: number): PixelRect {
  const x = Math.max(0, Math.floor(norm.x * width));
  const y = Math.max(0, Math.floor(norm.y * height));
  const w = Math.max(0, Math.min(width - x, Math.ceil(norm.w * width)));
  const h = Math.max(0, Math.min(height - y, Math.ceil(norm.h * height)));
  return { x, y, w, h };
}

interface PlaneSpan {
  r0: number;
  r1: number;
  /** Bytes [b0, b1) dentro da linha. */
  b0: number;
  b1: number;
}

/** Região do plano que cobre o retângulo em pixels (arredonda para fora na subamostragem). */
function planeSpan(p: PlaneGeometry, rect: PixelRect): PlaneSpan | null {
  if (rect.w <= 0 || rect.h <= 0) return null;
  const c0 = Math.max(0, Math.floor(rect.x / p.sx));
  const c1 = Math.min(p.cols, Math.ceil((rect.x + rect.w) / p.sx));
  const r0 = Math.max(0, Math.floor(rect.y / p.sy));
  const r1 = Math.min(p.rows, Math.ceil((rect.y + rect.h) / p.sy));
  if (c1 <= c0 || r1 <= r0) return null;
  return { r0, r1, b0: c0 * p.bps, b1: c1 * p.bps };
}

/** Copia o retângulo de `src` para `dst` (mesmo layout): a placa limpa sobre o quadro (RF-706). */
export function copyRect(src: Uint8Array, dst: Uint8Array, geom: FrameGeometry, rect: PixelRect): void {
  for (const p of geom.planes) {
    const s = planeSpan(p, rect);
    if (!s) continue;
    for (let r = s.r0; r < s.r1; r++) {
      const start = p.offset + r * p.stride;
      dst.set(src.subarray(start + s.b0, start + s.b1), start + s.b0);
    }
  }
}

/**
 * Copia `src` para `dst` (mesmo layout) inteiro, exceto o retângulo preservado, que mantém o conteúdo de `dst`:
 * atualiza a placa sem trazer o cursor desenhado no quadro (RF-702, C-703).
 */
export function copyAllExcept(
  src: Uint8Array,
  dst: Uint8Array,
  geom: FrameGeometry,
  preserve: PixelRect | null
): void {
  for (const p of geom.planes) {
    const s = preserve ? planeSpan(p, preserve) : null;
    const rowBytes = p.cols * p.bps;
    if (!s) {
      copyRows(src, dst, p, 0, p.rows, rowBytes);
      continue;
    }
    copyRows(src, dst, p, 0, s.r0, rowBytes);
    for (let r = s.r0; r < s.r1; r++) {
      const start = p.offset + r * p.stride;
      if (s.b0 > 0) dst.set(src.subarray(start, start + s.b0), start);
      if (s.b1 < rowBytes) dst.set(src.subarray(start + s.b1, start + rowBytes), start + s.b1);
    }
    copyRows(src, dst, p, s.r1, p.rows, rowBytes);
  }
}

function copyRows(
  src: Uint8Array,
  dst: Uint8Array,
  p: PlaneGeometry,
  r0: number,
  r1: number,
  rowBytes: number
): void {
  if (r1 <= r0) return;
  if (p.stride === rowBytes) {
    const a = p.offset + r0 * p.stride;
    const b = p.offset + r1 * p.stride;
    dst.set(src.subarray(a, b), a);
    return;
  }
  for (let r = r0; r < r1; r++) {
    const start = p.offset + r * p.stride;
    dst.set(src.subarray(start, start + rowBytes), start);
  }
}

/** Linhas de cada lado usadas como entorno (por plano). */
const NEIGHBOR_ROWS = 3;

/**
 * Preenche o retângulo pelo entorno, sem pixel limpo conhecido (RF-706): média das linhas logo acima e logo abaixo
 * da área, interpolada na vertical, coluna a coluna (mesmo critério do preenchimento no canvas). Sem linhas de um
 * lado, usa só o outro; sem nenhuma, deixa como está.
 */
export function fillFromNeighborhood(buf: Uint8Array, geom: FrameGeometry, rect: PixelRect): void {
  for (const p of geom.planes) {
    const s = planeSpan(p, rect);
    if (!s) continue;
    const width = s.b1 - s.b0;
    const above = averageRows(buf, p, s.r0 - NEIGHBOR_ROWS, s.r0, s.b0, width);
    const below = averageRows(buf, p, s.r1, s.r1 + NEIGHBOR_ROWS, s.b0, width);
    if (!above && !below) continue;
    const top = above ?? below!;
    const bottom = below ?? above!;
    const span = s.r1 - s.r0 + 1;
    for (let r = s.r0; r < s.r1; r++) {
      const t = (r - s.r0 + 1) / span;
      const start = p.offset + r * p.stride + s.b0;
      for (let i = 0; i < width; i++) {
        buf[start + i] = (top[i] + (bottom[i] - top[i]) * t + 0.5) | 0;
      }
    }
  }
}

function averageRows(
  buf: Uint8Array,
  p: PlaneGeometry,
  r0: number,
  r1: number,
  b0: number,
  width: number
): Float32Array | null {
  const from = Math.max(0, r0);
  const to = Math.min(p.rows, r1);
  if (to <= from) return null;
  const acc = new Float32Array(width);
  for (let r = from; r < to; r++) {
    const start = p.offset + r * p.stride + b0;
    for (let i = 0; i < width; i++) acc[i] += buf[start + i];
  }
  const n = to - from;
  for (let i = 0; i < width; i++) acc[i] /= n;
  return acc;
}
