import { useEffect, useState } from 'react'
import { collections } from './collections'
import { fabricate, type Fabrication, type FactoryInput } from './factory/fabricate'
import { requiresReview } from './factory/evaluate'
import { ScenePreview } from './factory/ProposalReview'
import type { Project } from './model'
import { StudioDialog } from './StudioDialog'
import { semantics } from './templates'
import { frameImage, rewriteVisualFrame } from './visualFrames'

export default function ProjectDesignOptions({ source, close, save }: {
  source: Project; close: () => void; save: (copy: Project) => Promise<void>
}) {
  const [result, setResult] = useState<Fabrication>()
  const [completed, setCompleted] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const style = collections.find(item => item.id === source.slides[0].layout.split(':')[1]) ?? collections[0]
    const slides = source.slides.map<FactoryInput['slides'][number]>(slide => {
      const content = semantics(slide.scene)
      return { ...content, role: slide.role === 'cover' || slide.role === 'cta' ? slide.role : 'content',
        headlines: slide.scene.objects.find(object => object.semantic === 'title')?.headlines as FactoryInput['slides'][number]['headlines'],
        imageBrief: slide.imageBrief, imageId: slide.visualChoice?.mode === 'none' ? null : undefined }
    })
    void fabricate({ style, slides, brand: source.brand, format: source.format, assets: [] }, controller.signal, setCompleted).then(
      value => { if (!controller.signal.aborted) setResult(value) },
      cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível montar os designs.') },
    )
    return () => controller.abort()
  }, [source])

  return <StudioDialog title="Explorar outros designs" close={() => { if (!saving) close() }}>
    <p>As propostas recompõem os campos editoriais em uma cópia. O projeto original fica na biblioteca.</p>
    {!result && !error && <progress aria-label="Montagem das opções de design" value={completed} max={source.slides.length} />}
    {error && <p role="alert">{error}</p>}
    {result && <div className="factory-options">{result.proposals.map(({ treatment, project, details }) => {
      const name = { balanced: 'Equilibrado', photo: 'Fotográfico', expressive: 'Expressivo' }[treatment]
      const affected = details.filter(detail => detail.issues.some(requiresReview)).length
      return <article key={treatment}>
        <div className="factory-thumb"><ScenePreview project={project} index={0} scale={.16} label={`Capa · ${name}`} /></div>
        <div className="factory-card-copy"><h3>{name}</h3>
          <p>{affected ? `${affected} slide(s) para revisar` : 'Sem avisos de encaixe ou recorte'}</p>
          <button className="button button-outline" disabled={saving} aria-label={`Criar cópia · ${name}`} onClick={() => {
            setSaving(true)
            setError('')
            const slides = project.slides.map((slide, index) => {
              const original = source.slides[index]
              const fields = { ...slide, visualContext: original.visualContext, visualSubtitle: original.visualSubtitle }
              if (original.visualChoice?.mode === 'none') return rewriteVisualFrame(fields, original.visualChoice)
              return { ...fields, visualChoice: frameImage(slide.scene)
                ? { ...original.visualChoice, mode: original.visualChoice?.mode === 'locked' ? 'locked' as const : 'manual' as const }
                : original.visualChoice?.mode === 'automatic' ? original.visualChoice : undefined }
            })
            const copy = { ...source, id: project.id, createdAt: project.createdAt, updatedAt: project.updatedAt,
              name: source.name.slice(0, 86) + ' · ' + name, brand: project.brand, slides }
            void save(copy).catch(cause => {
              setSaving(false)
              setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a cópia.')
            })
          }}>Criar cópia</button>
        </div>
      </article>
    })}</div>}
  </StudioDialog>
}
