/**
 * Impede que soltar arquivos do sistema fora de uma zona de soltar faça a janela navegar até o arquivo
 * (018-arquivos-arrastar, RF-190). A zona de soltar da aba Arquivos trata o próprio `drop` e interrompe a
 * propagação; aqui só chegam os arrastes soltos em qualquer outro ponto da janela.
 *
 * É a primeira camada; a segunda é o guard de navegação do main (`navigationGuard.ts`, RNF-181).
 */

/** Indica se o arraste carrega arquivos do sistema (e não texto ou links). */
export function hasDraggedFiles(event: Pick<DragEvent, 'dataTransfer'>): boolean {
  const types = event.dataTransfer?.types
  if (!types) return false
  return Array.from(types as ArrayLike<string>).includes('Files')
}

/**
 * Registra os listeners de `dragover` e `drop` em `target` e devolve a função que os remove.
 * Arrastes sem arquivos não são alterados.
 */
export function installFileDropGuard(target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window): () => void {
  const onDragOver = (event: Event) => {
    const dragEvent = event as DragEvent
    if (!hasDraggedFiles(dragEvent)) return
    dragEvent.preventDefault()
    if (dragEvent.dataTransfer) {
      dragEvent.dataTransfer.dropEffect = 'none'
    }
  }

  const onDrop = (event: Event) => {
    if (!hasDraggedFiles(event as DragEvent)) return
    event.preventDefault()
  }

  target.addEventListener('dragover', onDragOver)
  target.addEventListener('drop', onDrop)

  return () => {
    target.removeEventListener('dragover', onDragOver)
    target.removeEventListener('drop', onDrop)
  }
}
