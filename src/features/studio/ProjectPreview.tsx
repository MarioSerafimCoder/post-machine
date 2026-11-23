import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { renderScene } from './export'
import { loadProject } from './storage'
import { loadFonts } from './fonts'
import { dimensions } from './model'
const previews = new Map<string, Blob>()
let previewQueue = Promise.resolve()

export default function ProjectPreview({ item }: { item: { id: string; revision: string | number; format?: string } }) {
  const target = useRef<HTMLSpanElement>(null)
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    const node = target.current
    if (!node) return
    const controller = new AbortController()
    let url: string | undefined
    const key = item.id + ':' + item.revision
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      previewQueue = previewQueue.then(async () => {
        controller.signal.throwIfAborted()
        let blob = previews.get(key)
        if (!blob) {
          const project = await loadProject(item.id)
          controller.signal.throwIfAborted()
          const first = project.slides[0]
          if (!first?.scene.objects.length) return
          await loadFonts(project.brand)
          const [width, height] = dimensions[project.format]
          blob = (await renderScene(first.scene, width, height, { scale: 320 / Math.max(width, height), signal: controller.signal })).blob
          if (previews.size >= 48) previews.delete(previews.keys().next().value!)
          previews.set(key, blob)
        }
        controller.signal.throwIfAborted()
        url = URL.createObjectURL(blob)
        setSrc(url)
      }).catch(() => undefined)
    }, { rootMargin: '120px' })
    observer.observe(node)
    return () => { controller.abort(); observer.disconnect(); if (url) URL.revokeObjectURL(url) }
  }, [item.id, item.revision])
  return <span ref={target} className="library-preview" aria-hidden="true">
    {src ? <img src={src} alt="" /> : <span className="library-placeholder" data-format={item.format}><Icon name="studio" /></span>}
  </span>
}
