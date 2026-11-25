import { useEffect, useEffectEvent, type RefObject } from 'react'
import { Canvas, Textbox } from 'fabric'
import { resolvePage } from '../../lib/navigation'
import { duplicate } from './objects'

export function useStudioShortcuts(active: boolean, canvas: RefObject<Canvas | null>, changed: () => void,
  moveHistory: (redo: boolean) => void, error: (message: string) => void) {
  const historyKey = useEffectEvent(moveHistory)
  useEffect(() => {
    if (!active) return
    const key = (event: KeyboardEvent) => {
      const target = canvas.current
      if (event.defaultPrevented || resolvePage(window.location.hash) !== 'studio' || document.querySelector('dialog[open]') || !target ||
          event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable=true]')) return
      const selected = target.getActiveObject()
      if (selected instanceof Textbox && selected.isEditing) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); historyKey(event.shiftKey); return }
      if (event.key === 'Delete' && selected) { event.preventDefault(); target.remove(...target.getActiveObjects()); target.discardActiveObject(); changed() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selected) {
        event.preventDefault()
        void duplicate(target).then(() => { if (canvas.current === target) changed() }, () => error('Não foi possível duplicar o elemento.'))
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active, canvas, changed, error])
}
