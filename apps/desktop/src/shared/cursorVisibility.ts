export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Extrai o identificador numérico nativo da janela (HWND no Windows, CGWindowID no macOS, XID no Linux)
 * a partir do sourceId retornado pelo desktopCapturer do Electron (formato "window:<id>:<index>").
 */
export function parseWindowHandle(sourceId: string): bigint | null {
  if (!sourceId || typeof sourceId !== 'string') return null;
  const match = /^window:([^:]+):/i.exec(sourceId.trim());
  if (!match || !match[1]) return null;
  const raw = match[1].trim();
  try {
    const val = raw.startsWith('0x') || raw.startsWith('0X') ? BigInt(raw) : BigInt(raw);
    return val > 0n ? val : null;
  } catch {
    return null;
  }
}

export function containsPoint(rect: Rect | null | undefined, pt: Point): boolean {
  if (!rect || rect.w <= 0 || rect.h <= 0) return false;
  return (
    pt.x >= rect.x &&
    pt.x < rect.x + rect.w &&
    pt.y >= rect.y &&
    pt.y < rect.y + rect.h
  );
}

/**
 * Regra de visibilidade no Modo Janela Específica:
 * O cursor só deve aparecer na transmissão quando a janela transmitida está em primeiro plano (foco)
 * E a janela diretamente sob o ponteiro do mouse é a própria janela transmitida.
 */
export function isCursorVisibleWindowMode(params: {
  foreground: bigint | null;
  underCursor: bigint | null;
  target: bigint | null;
}): boolean {
  if (!params.target || params.foreground === null || params.underCursor === null) {
    return false;
  }
  return params.foreground === params.target && params.underCursor === params.target;
}

/**
 * Regra de visibilidade no Modo Tela Cheia:
 * O cursor deve sumir quando o ponteiro está fisicamente sobre a área visível da janela do MLab
 * (sem estar encoberto por outra janela por cima do MLab).
 */
export function isCursorVisibleScreenMode(params: {
  isMlabUnderCursor: boolean;
  cursorInMlabBounds: boolean;
}): boolean {
  return !(params.isMlabUnderCursor && params.cursorInMlabBounds);
}

/**
 * Converte a posição do cursor (no mesmo espaço de coordenadas de `source`) em um retângulo
 * normalizado [0..1] cobrindo o desenho do ponteiro e margem proporcional à velocidade.
 * Retorna null caso o cursor esteja fora dos limites da fonte capturada.
 */
export function toNormalizedCursorRect(
  cursor: Point,
  source: Rect | null | undefined,
  scaleFactor = 1,
  velocity: { vx: number; vy: number } = { vx: 0, vy: 0 }
): NormRect | null {
  if (!source || !containsPoint(source, cursor)) {
    return null;
  }

  const scale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  const speed = Math.hypot(velocity.vx || 0, velocity.vy || 0);
  const motionMargin = Math.min(56 * scale, speed * 1.4);

  // Cursores do SO (seta, mão, I-beam) têm o hotspot próximo ao canto superior esquerdo,
  // estendendo-se ~32px para direita/baixo (multiplicado pelo DPI) e ~14px para cima/esquerda.
  const padLeft = 16 * scale + motionMargin * 0.5;
  const padTop = 16 * scale + motionMargin * 0.5;
  const padRight = 36 * scale + motionMargin * 0.5;
  const padBottom = 38 * scale + motionMargin * 0.5;

  const relX = cursor.x - source.x;
  const relY = cursor.y - source.y;

  const x0 = Math.max(0, relX - padLeft);
  const y0 = Math.max(0, relY - padTop);
  const x1 = Math.min(source.w, relX + padRight);
  const y1 = Math.min(source.h, relY + padBottom);

  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) {
    return null;
  }

  return {
    x: x0 / source.w,
    y: y0 / source.h,
    w: w / source.w,
    h: h / source.h,
  };
}
