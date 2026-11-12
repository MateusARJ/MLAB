import type { AnnotationOverlayState, CursorState } from '@mlab/types';

/**
 * Caminho de um quadro no worker de vídeo (007, RF-701/RF-702).
 * - `compose: false` → repasse sem cópia do quadro capturado, sem gerar quadro novo.
 * - `maskCursor` → apagar a área do cursor no quadro composto.
 * - `drawAnnotations` → desenhar marcações/Lupa no quadro composto.
 * - `drawSpotlight` → entre as anotações, desenhar a Lupa (RF-708: no modo janela, segue a regra do cursor).
 */
export interface FramePath {
  compose: boolean;
  maskCursor: boolean;
  drawAnnotations: boolean;
  drawSpotlight: boolean;
}

/**
 * No modo 'screen' com a janela de overlay externa ativa, o capturador do SO já captura os traços e a Lupa,
 * exceto quando a Lupa usa ampliação óptica (zoom > 1), que só o worker consegue desenhar.
 */
export function isCapturedNativelyByScreen(ann: AnnotationOverlayState): boolean {
  return (
    ann.captureMode === 'screen' &&
    ann.externalOverlayActive === true &&
    !(ann.spotlight.enabled && (ann.spotlight.zoom || 1) > 1)
  );
}

/** O cursor deve ser apagado: dentro da fonte (`rect` com área) e marcado como não visível. */
export function shouldMaskCursor(cursor: CursorState): boolean {
  const r = cursor.rect;
  return !cursor.visible && r !== null && r.w > 0 && r.h > 0;
}

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function hasArea(r: NormRect | null): r is NormRect {
  return r !== null && r.w > 0 && r.h > 0;
}

export function rectsOverlap(a: NormRect | null, b: NormRect | null): boolean {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function unionRect(a: NormRect | null, b: NormRect | null): NormRect | null {
  if (!hasArea(a)) return hasArea(b) ? b : null;
  if (!hasArea(b)) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

/** Janela do rastro: cobre o atraso entre o estado do cursor (IPC) e o quadro capturado (C-703). */
export const CURSOR_TRAIL_MS = 150;

/**
 * Rastro do cursor (007, RF-701, C-703). O quadro capturado chega alguns quadros depois do estado do cursor; com o
 * mouse rápido, o cursor desenhado no quadro está numa posição anterior. O rastro guarda cada estado com o instante em
 * que passou a valer e devolve a união dos retângulos vigentes na janela recente.
 */
export class CursorTrail {
  private entries: { rect: NormRect | null; masked: boolean; since: number }[] = [];

  constructor(private readonly trailMs: number = CURSOR_TRAIL_MS) {}

  push(state: CursorState, now: number): void {
    this.entries.push({ rect: state.rect, masked: shouldMaskCursor(state), since: now });
    this.prune(now);
  }

  /** União dos retângulos em que o cursor devia estar oculto (área a apagar). */
  maskRect(now: number): NormRect | null {
    return this.union(now, true);
  }

  /** União de todos os retângulos do cursor, visível ou não (área a preservar na placa de fundo). */
  anyRect(now: number): NormRect | null {
    return this.union(now, false);
  }

  private union(now: number, onlyMasked: boolean): NormRect | null {
    this.prune(now);
    let out: NormRect | null = null;
    for (const e of this.entries) {
      if (onlyMasked && !e.masked) continue;
      out = unionRect(out, e.rect);
    }
    return out;
  }

  /** Remove estados que deixaram de valer antes do início da janela (mantém sempre o atual). */
  private prune(now: number): void {
    const cutoff = now - this.trailMs;
    while (this.entries.length > 1 && this.entries[1].since <= cutoff) {
      this.entries.shift();
    }
  }
}

/**
 * A Lupa entra no quadro (007, RF-708, C-705)? No modo janela, só quando o cursor deve aparecer (janela transmitida em
 * foco e sob o ponteiro, mesma regra da US-20) ou quando foi posicionada no visualizador do MLab. Nos demais modos, a
 * regra não muda: Lupa ligada, Lupa desenhada.
 */
export function shouldDrawSpotlight(cursor: CursorState, ann: AnnotationOverlayState): boolean {
  if (!ann.spotlight.enabled) return false;
  if (ann.captureMode !== 'window') return true;
  if (ann.spotlight.activeInViewer === true) return true;
  return cursor.visible && cursor.rect !== null;
}

export function decideFramePath(
  maskRect: NormRect | null,
  ann: AnnotationOverlayState,
  maskSuspended: boolean,
  cursor: CursorState
): FramePath {
  const maskCursor = !maskSuspended && hasArea(maskRect);
  const hasStrokes = ann.strokes.length > 0 || ann.activeStroke !== null;
  const spotlight = shouldDrawSpotlight(cursor, ann);
  const drawAnnotations = (hasStrokes || spotlight) && !isCapturedNativelyByScreen(ann);
  return {
    compose: maskCursor || drawAnnotations,
    maskCursor,
    drawAnnotations,
    drawSpotlight: drawAnnotations && spotlight,
  };
}

export interface FrameBudgetOptions {
  /** Orçamento médio por quadro com máscara (ms). Padrão: 8 ms, metade do intervalo a 60 fps. */
  budgetMs?: number;
  /** Peso da amostra nova na média móvel exponencial. */
  alpha?: number;
  /** Amostras mínimas antes de decidir pela suspensão. */
  minSamples?: number;
  /** Primeira espera até retentar a máscara (ms); dobra a cada nova suspensão. */
  initialRetryMs?: number;
  /** Espera máxima até retentar (ms). */
  maxRetryMs?: number;
}

export type FrameBudgetEvent =
  | { type: 'mask-suspended'; avgMs: number; retryInMs: number }
  | { type: 'mask-resumed' };

/**
 * Proteção de FPS da máscara do cursor (007, RF-703; C-701: o FPS tem prioridade sobre a ocultação).
 * Mede o custo médio dos quadros com máscara; acima do orçamento, suspende a máscara e a retenta depois,
 * com espera crescente para o cursor não ficar aparecendo e sumindo.
 */
export class FrameBudgetGuard {
  private readonly budgetMs: number;
  private readonly alpha: number;
  private readonly minSamples: number;
  private readonly maxRetryMs: number;
  private nextRetryMs: number;
  private avgMs = 0;
  private samples = 0;
  private suspendedUntil: number | null = null;

  constructor(
    private readonly now: () => number = () => performance.now(),
    options: FrameBudgetOptions = {}
  ) {
    this.budgetMs = options.budgetMs ?? 8;
    this.alpha = options.alpha ?? 0.1;
    this.minSamples = options.minSamples ?? 10;
    this.nextRetryMs = options.initialRetryMs ?? 5000;
    this.maxRetryMs = options.maxRetryMs ?? 60000;
  }

  get isSuspended(): boolean {
    return this.suspendedUntil !== null;
  }

  /** Chamado a cada quadro: encerra a suspensão quando a espera termina. */
  poll(): FrameBudgetEvent | null {
    if (this.suspendedUntil !== null && this.now() >= this.suspendedUntil) {
      this.suspendedUntil = null;
      this.avgMs = 0;
      this.samples = 0;
      return { type: 'mask-resumed' };
    }
    return null;
  }

  /** Registra o custo de um quadro com máscara; devolve o evento de suspensão quando o orçamento estoura. */
  record(elapsedMs: number): FrameBudgetEvent | null {
    if (this.suspendedUntil !== null) return null;
    this.avgMs = this.samples === 0 ? elapsedMs : this.avgMs * (1 - this.alpha) + elapsedMs * this.alpha;
    this.samples += 1;
    if (this.samples < this.minSamples || this.avgMs <= this.budgetMs) return null;

    const retryInMs = this.nextRetryMs;
    this.suspendedUntil = this.now() + retryInMs;
    this.nextRetryMs = Math.min(this.nextRetryMs * 2, this.maxRetryMs);
    return { type: 'mask-suspended', avgMs: Math.round(this.avgMs * 100) / 100, retryInMs };
  }
}
