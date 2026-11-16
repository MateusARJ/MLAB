/**
 * Posição da barra de marcação interna da sala (028, RF-2815, issue #89).
 * A barra precisa ficar inteira dentro da prévia ao abrir, ao arrastar e ao redimensionar a janela.
 */
export const ANNOTATION_TOOLBAR_MARGIN = 8;

export interface BoxSize {
  width: number;
  height: number;
}

export interface ToolbarPosition {
  x: number;
  y: number;
}

/**
 * Limita a posição (canto superior esquerdo, relativa à prévia) para a barra caber inteira na prévia.
 * Se a barra for maior que a prévia, ela encosta na margem de cima/esquerda; a altura é resolvida pela
 * rolagem interna da barra (maxHeight no estilo).
 */
export function clampAnnotationToolbarPosition(
  pos: ToolbarPosition,
  container: BoxSize,
  toolbar: BoxSize,
  margin: number = ANNOTATION_TOOLBAR_MARGIN,
): ToolbarPosition {
  const maxX = Math.max(margin, container.width - toolbar.width - margin);
  const maxY = Math.max(margin, container.height - toolbar.height - margin);
  return {
    x: Math.min(maxX, Math.max(margin, Math.round(pos.x))),
    y: Math.min(maxY, Math.max(margin, Math.round(pos.y))),
  };
}
