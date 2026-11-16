import { describe, it, expect, afterEach } from 'vitest'
import { installFileDropGuard, hasDraggedFiles } from './preventFileDropNavigation'

function dragEvent(type: 'dragover' | 'drop', types: string[]) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const dataTransfer = { types, dropEffect: 'copy' as DataTransfer['dropEffect'] }
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  return { event, dataTransfer }
}

describe('preventFileDropNavigation', () => {
  let uninstall: (() => void) | null = null

  afterEach(() => {
    uninstall?.()
    uninstall = null
  })

  it('identifica arrastes com arquivos do sistema', () => {
    expect(hasDraggedFiles(dragEvent('drop', ['Files']).event as DragEvent)).toBe(true)
    expect(hasDraggedFiles(dragEvent('drop', ['text/plain', 'text/uri-list']).event as DragEvent)).toBe(false)
    expect(hasDraggedFiles({ dataTransfer: null })).toBe(false)
  })

  it('cancela dragover e drop com arquivos soltos fora de uma zona (RF-190)', () => {
    uninstall = installFileDropGuard(window)

    const over = dragEvent('dragover', ['Files'])
    document.body.dispatchEvent(over.event)
    expect(over.event.defaultPrevented).toBe(true)
    expect(over.dataTransfer.dropEffect).toBe('none')

    const drop = dragEvent('drop', ['Files'])
    document.body.dispatchEvent(drop.event)
    expect(drop.event.defaultPrevented).toBe(true)
  })

  it('não altera arrastes de texto ou link', () => {
    uninstall = installFileDropGuard(window)

    const over = dragEvent('dragover', ['text/plain'])
    document.body.dispatchEvent(over.event)
    expect(over.event.defaultPrevented).toBe(false)
    expect(over.dataTransfer.dropEffect).toBe('copy')

    const drop = dragEvent('drop', ['text/uri-list'])
    document.body.dispatchEvent(drop.event)
    expect(drop.event.defaultPrevented).toBe(false)
  })

  it('o cancelamento remove os listeners', () => {
    installFileDropGuard(window)()

    const drop = dragEvent('drop', ['Files'])
    document.body.dispatchEvent(drop.event)
    expect(drop.event.defaultPrevented).toBe(false)
  })
})
