import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function StudioDialog({ title, close, children, closeLabel = 'Fechar' }: { closeLabel?: string; title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    dialog.showModal()
    heading.current?.focus()
    return () => { if (dialog.open) dialog.close(); trigger?.focus() }
  }, [])
  return <dialog ref={ref} className="studio-dialog" aria-label={title} onCancel={event => { event.preventDefault(); close() }}>
    <header><h2 tabIndex={-1} ref={heading}>{title}</h2>
      <button type="button" className="button button-outline" onClick={close}>{closeLabel}</button>
    </header>
    {children}
  </dialog>
}
