import { useEffect, useState } from 'react'
import type { Project } from './model'

// Hash only exportable content, never timestamps or UI state. Old backups remain valid.
export async function exportFingerprint(project: Project) {
  const content = JSON.stringify({ format: project.format, slides: project.slides, caption: project.caption ?? '', name: project.name }, (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function useDeliveryStatus(project?: Project) {
  const [checked, setChecked] = useState<{ project: Project; matches: boolean }>()
  useEffect(() => {
    if (!project?.delivery) return
    let active = true
    void exportFingerprint(project).then(value => {
      if (active) setChecked({ project, matches: value === project.delivery?.fingerprint })
    }).catch(() => undefined)
    return () => { active = false }
  }, [project])
  if (!project?.delivery) return 'Pendente de revisão'
  if (checked?.project !== project) return 'Conferindo exportação…'
  if (!checked.matches) return 'Alterado após exportação'
  return project.delivery.scope === 'all' ? 'Exportado' : 'Slide exportado · carrossel pendente'
}
