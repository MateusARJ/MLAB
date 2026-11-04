import type { AnnotationToolbarRect } from '@mlab/types';

/**
 * Hit-test da barra de marcação no Linux (009, RF-901 / C-901).
 *
 * No Linux, `setIgnoreMouseEvents(true, { forward: true })` não encaminha eventos de mouse ao renderer, então o
 * overlay nunca sabe que o ponteiro entrou na barra. O main compara a posição do ponteiro na tela com o retângulo
 * informado pelo overlay e decide se o overlay deve sair do click-through.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface OverlayBounds {
  x: number;
  y: number;
}

/** Folga em volta da barra, em DIP, para a borda não alternar o click-through a cada pixel. */
export const TOOLBAR_HIT_MARGIN = 4;

/**
 * Verdadeiro se o ponteiro (coordenadas de tela em DIP) está sobre o retângulo da barra (coordenadas do overlay),
 * com `margin` de folga. Retângulo `null` nunca é atingido.
 */
export function isPointerOverToolbar(
  cursor: ScreenPoint,
  overlayBounds: OverlayBounds,
  rect: AnnotationToolbarRect | null,
  margin: number = TOOLBAR_HIT_MARGIN
): boolean {
  if (!rect) return false;
  const left = overlayBounds.x + rect.x - margin;
  const top = overlayBounds.y + rect.y - margin;
  const right = overlayBounds.x + rect.x + rect.width + margin;
  const bottom = overlayBounds.y + rect.y + rect.height + margin;
  return cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom;
}

/** Valor efetivo do click-through: o pedido do renderer, exceto com o ponteiro sobre a barra. */
export function resolveIgnoreMouse(requestedIgnore: boolean, pointerOverToolbar: boolean): boolean {
  return requestedIgnore && !pointerOverToolbar;
}

/**
 * Valida o retângulo recebido por IPC (Princípio II: nunca confiar no renderer). Devolve `null` para qualquer
 * valor que não seja um retângulo numérico finito, com largura e altura positivas e no máximo `maxWidth`×`maxHeight`.
 */
export function sanitizeToolbarRect(
  input: unknown,
  maxWidth: number,
  maxHeight: number
): AnnotationToolbarRect | null {
  if (!input || typeof input !== 'object') return null;
  const { x, y, width, height } = input as Record<string, unknown>;
  if (![x, y, width, height].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const rect = { x: x as number, y: y as number, width: width as number, height: height as number };
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (rect.width > maxWidth || rect.height > maxHeight) return null;
  if (Math.abs(rect.x) > maxWidth || Math.abs(rect.y) > maxHeight) return null;
  return rect;
}
