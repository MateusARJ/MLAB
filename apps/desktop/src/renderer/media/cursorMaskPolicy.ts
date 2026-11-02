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
