import { lazy, Suspense, useEffect, useState } from 'react'
import type { recentProjects } from '../features/studio/database'
import { Icon } from './Icon'

const ProjectPreview = lazy(() => import('../features/studio/ProjectPreview'))
type Summary = Awaited<ReturnType<typeof recentProjects>>[number]

export function ResumeProject({ open, resume }: { open: (id: string) => void; resume: () => void }) {
  const [result, setResult] = useState<{ projects: Summary[]; preparation: boolean } | null>()
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    void import('../features/studio/database').then(({ recentProjects, hasIndependentPreparation, projectsChangedEvent }) => {
      if (!active) return
      let generation = 0
      const refresh = () => {
        const request = ++generation
        void Promise.all([recentProjects(), hasIndependentPreparation()]).then(([projects, preparation]) => {
          if (active && request === generation) setResult({ projects, preparation })
        }, () => { if (active && request === generation) setResult(null) })
      }
      window.addEventListener(projectsChangedEvent, refresh)
      unsubscribe = () => window.removeEventListener(projectsChangedEvent, refresh)
      refresh()
    }, () => { if (active) setResult(null) })
    return () => { active = false; unsubscribe?.() }
  }, [])
  return <section className="production-section" aria-labelledby="resume-heading">
    <header><h2 id="resume-heading">Continue produzindo</h2><a className="text-button" href="#/studio">Ver projetos</a></header>
    {result === undefined && <p role="status">Buscando projetos locais…</p>}
    {result === null && <p role="status">Não foi possível consultar os projetos deste navegador.</p>}
    {result && !result.projects.length && !result.preparation && <p>Seus projetos e preparações locais aparecem aqui depois que você começa.</p>}
    {result?.preparation && <button className="button button-outline" onClick={resume}>Retomar preparação</button>}
    <div className="production-grid">{result?.projects.map(project => <article className="resume-project" key={project.id}>
      <div className="resume-project-copy">
        <Suspense fallback={<Icon name="folder" />}><ProjectPreview key={project.updatedAt} item={{ id: project.id, revision: project.updatedAt }} /></Suspense>
        <div><h3>{project.name || 'Projeto sem nome'}</h3><p>Revisão e edição · {project.slideCount} {project.slideCount === 1 ? 'slide' : 'slides'}</p></div>
      </div>
      <button className="button button-outline" onClick={() => open(project.id)}>Continuar editando</button>
    </article>)}</div>
  </section>
}
