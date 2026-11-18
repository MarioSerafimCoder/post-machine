import { useEffect, useState } from 'react'
import type { Project } from '../features/studio/model'
import { Icon } from './Icon'

const projectDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
type Summary = Pick<Project, 'id' | 'name' | 'updatedAt'>

export function ResumeProject({ open }: { open: (id?: string) => void }) {
  const [result, setResult] = useState<{ project?: Summary; error?: boolean }>()
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    void import('../features/studio/database').then(({ latestProject, projectsChangedEvent }) => {
      if (!active) return
      let generation = 0
      const refresh = () => {
        const request = ++generation
        void latestProject().then(project => {
          if (active && request === generation) setResult({ project })
        }, () => { if (active && request === generation) setResult({ error: true }) })
      }
      window.addEventListener(projectsChangedEvent, refresh)
      unsubscribe = () => window.removeEventListener(projectsChangedEvent, refresh)
      refresh()
    }, () => { if (active) setResult({ error: true }) })
    return () => { active = false; unsubscribe?.() }
  }, [])
  const project = result?.project
  return <section className="resume-project" aria-labelledby="resume-heading">
    <div className="resume-project-copy"><Icon name="folder" /><div>
      <h2 id="resume-heading">Continue de onde parou</h2>
      {project ? <p><strong>{project.name || 'Projeto sem nome'}</strong> <time dateTime={project.updatedAt}>{projectDate.format(new Date(project.updatedAt))}</time></p>
        : <p role="status">{!result ? 'Buscando projetos locais…' : result.error ? 'Não foi possível consultar os projetos deste navegador.' : 'Crie um projeto vazio ou encontre uma pauta para começar.'}</p>}
    </div></div>
    {project ? <button className="button button-dark" onClick={() => open(project.id)}>Continuar editando</button>
      : result && <div className="resume-actions"><a className="button button-outline" href="#/radar">Explorar pautas</a>
        {result.error ? <a className="button button-dark" href="#/studio">Abrir Studio</a>
          : <button className="button button-dark" onClick={() => open()}>Criar projeto</button>}</div>}
  </section>
}
