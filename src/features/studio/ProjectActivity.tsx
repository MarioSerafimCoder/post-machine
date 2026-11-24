import { useEffect, useState } from 'react'
import { loadProject } from './storage'
import { exportFingerprint } from './delivery'
import { recallReview } from '../audit/reviewStorage'

export function ProjectActivity({ id, revision }: { id: string; revision: string }) {
  const [state, setState] = useState('Consultando revisão…')
  useEffect(() => {
    let active = true
    void loadProject(id).then(async project => {
      const review = await recallReview(project)
      let label = 'Pendente de revisão'
      if (review) {
        const count = review.findings.filter(f => f.severity !== 'info').length
        label = `${count} ${count === 1 ? 'ocorrência' : 'ocorrências'} · revisão ${new Date(review.analyzedAt).toLocaleDateString('pt-BR')}`
      }
      if (project.delivery) {
        const match = await exportFingerprint(project) === project.delivery.fingerprint
        label = (match ? project.delivery.scope === 'all' ? 'Exportado' : 'Slide exportado' : 'Alterado após exportação') + ' · ' + label
      }
      if (active) setState(label)
    }).catch(() => { if (active) setState('Revisão indisponível') })
    return () => { active = false }
  }, [id, revision])
  return <span className="project-activity">{state}</span>
}
