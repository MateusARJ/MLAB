import type { AnnotationOverlayState, CursorState } from '@mlab/types';

/**
 * Caminho de um quadro no worker de vídeo (007, RF-701/RF-702).
 * - `compose: false` → repasse sem cópia do quadro capturado (nenhum processamento adicional).
 * - `maskCursor` → apagar a área do cursor no quadro composto.
 * - `drawAnnotations` → desenhar marcações/Lupa no quadro composto.
 */
export interface FramePath {
  compose: boolean;
  maskCursor: boolean;
  drawAnnotations: boolean;
}

export function hasAnyAnnotation(ann: AnnotationOverlayState): boolean {
  return ann.strokes.length > 0 || ann.activeStroke !== null || ann.spotlight.enabled === true;
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

export function decideFramePath(
  cursor: CursorState,
  ann: AnnotationOverlayState,
  maskSuspended: boolean
): FramePath {
  const maskCursor = !maskSuspended && shouldMaskCursor(cursor);
  const drawAnnotations = hasAnyAnnotation(ann) && !isCapturedNativelyByScreen(ann);
  return { compose: maskCursor || drawAnnotations, maskCursor, drawAnnotations };
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
