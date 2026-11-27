import type { CampaignEntry } from './features/campaigns/CampaignStart'
import type { DesignMode, Draft } from './features/campaigns/contract'
import { lazy, Suspense } from 'react'
import { AssistantSignals, createAssistantSignals, useAssistantSignal } from './features/intelligence/signals'
const Assistant = lazy(() => import('./features/intelligence/Assistant'))
const Studio = lazy(() => import('./features/studio/Studio').then(module => ({ default: module.Studio })))
const Radar = lazy(() => import('./features/radar/Radar').then(module => ({ default: module.Radar })))
const AuditPage = lazy(() => import('./features/audit/AuditPage').then(module => ({ default: module.AuditPage })))
import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { Roadmap } from './components/Roadmap'
import { ResumeProject } from './components/ResumeProject'
import { CreateContent } from './components/CreateContent'
import type { ContentOrigin } from './components/productionOrigins'
import { ProductionHome } from './components/ProductionHome'
import type { Article } from './features/radar/contract'
import { resolvePage, usePage, type Page } from './lib/navigation'

const nav: { id: Page; label: string; icon: IconName }[] = [
  { id: 'inicio', label: 'Visão geral', icon: 'home' }, { id: 'radar', label: 'Radar', icon: 'radar' },
  { id: 'studio', label: 'Studio', icon: 'studio' }, { id: 'auditoria', label: 'Auditoria', icon: 'audit' },
]

export function App() {
  const page = usePage()
  const [assistantSignals] = useState(createAssistantSignals)
  const [visited, setVisited] = useState({ studio: false, radar: false })
  const [radarStart, setRadarStart] = useState<CampaignEntry>()
  const [studioEntry, setStudioEntry] = useState<{ projectId?: string; mode?: 'import' | 'blank'; file?: File }>()
  const [creating, setCreating] = useState(false)
  function openDesign(draft: Draft, mode?: DesignMode) {
    setStudioEntry(undefined)
    setDesignRequest({ draft, mode })
    window.location.assign('#/studio')
  }
  async function startArticle(article: Article) {
    const { openArticleCampaign } = await import('./features/campaigns/storage')
    const draft = await openArticleCampaign(article)
    if (resolvePage(window.location.hash) === 'inicio') openDesign(draft, 'radar')
  }
  function startContent(origin: ContentOrigin, file?: File) {
    setCreating(false)
    if (origin === 'radar') {
      setRadarStart({ mode: 'radar' })
      window.location.assign('#/radar')
    } else {
      setDesignRequest(null)
      setStudioEntry({ mode: origin, file })
      window.location.assign('#/studio')
    }
  }
  useEffect(() => {
    if (page !== 'studio' && page !== 'radar') return
    const timer = setTimeout(() => setVisited(current => current[page] ? current : { ...current, [page]: true }), 0)
    return () => clearTimeout(timer)
  }, [page])
  const [designRequest, setDesignRequest] = useState<{ draft: Draft; mode?: DesignMode } | null>(null)
  const [roadmap, setRoadmap] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const label = nav.find(item => item.id === page)?.label ?? 'Página não encontrada'
  const previousLabel = useRef(label)
  useEffect(() => {
    document.title = `${label} — Post Machine`
    if (previousLabel.current !== label) {
      const visibleHeading = page === 'studio' ? heading.current?.parentElement?.querySelector<HTMLElement>('.studio-library h1') : null
      const target = visibleHeading ?? heading.current
      target?.focus()
    }
    previousLabel.current = label
  }, [label, page])
  return <AssistantSignals.Provider value={assistantSignals}><section className="desktop-required" aria-label="Disponível somente para desktop"><span className="brand-mark" aria-hidden="true">PM</span><h1>Um espaço para criar no desktop.</h1><p>O Post Machine foi feito exclusivamente para computadores. Abra em um desktop ou amplie a janela para pelo menos 1024 px.</p></section><div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Pular para o conteúdo</a>
    <div className="main-shell">
      <header className="topbar">
        <a className="brand" href="#/inicio" aria-label="Post Machine — início"><span className="brand-mark">PM</span><span>Post Machine</span></a>
        <nav className="primary-nav" aria-label="Navegação principal">{nav.map(item =>
          <a key={item.id} className="nav-link" href={`#/${item.id}`} aria-current={page === item.id ? 'page' : undefined}>
            <Icon name={item.icon} /><span>{item.id === 'inicio' ? 'Início' : item.label}</span>
          </a>
        )}</nav>
        <div className="topbar-actions">
          <button className="button button-dark" onClick={() => setCreating(true)}>Criar carrossel</button>
          <button className="text-button" onClick={() => setRoadmap(true)}><Icon name="book" /><span>Como funciona</span></button>
        </div>
      </header>
      <main id="main-content" className={page === 'inicio' ? 'home-workspace' : 'active-workspace'} tabIndex={-1}>
        <h1 ref={heading} tabIndex={-1}>{page === 'inicio' ? 'O que vamos criar hoje?' : label}</h1>
        {page === 'inicio' && <>
          <ProductionHome create={() => setCreating(true)} discover={() => startContent('radar')} startArticle={startArticle}>
            <HomeGuidance importContent={() => startContent('import')} />
            <ResumeProject resume={() => startContent('import')} open={projectId => {
              setDesignRequest(null)
              setStudioEntry({ projectId })
              window.location.hash = '/studio'
            }} />
          </ProductionHome>
        </>}
        {(page === 'radar' || visited.radar) && <div hidden={page !== 'radar'}><Suspense fallback={<p role="status">Carregando o Radar…</p>}>
          <Radar active={page === 'radar'} start={radarStart} onDesign={openDesign} />
        </Suspense></div>}
        {(page === 'studio' || visited.studio) && <div hidden={page !== 'studio'}><Suspense fallback={<p role="status">Carregando Studio…</p>}><Studio request={designRequest} homeEntry={studioEntry} active={page === 'studio'} onStartCampaign={(mode, campaignId) => { setRadarStart({ mode, campaignId }); window.location.hash = '/radar' }} /></Suspense></div>}
        {page === 'auditoria' && <Suspense fallback={<p>Carregando auditoria…</p>}><AuditPage /></Suspense>}
        {page === 'not-found' && <section className="empty-state"><Icon name="home" /><h2>Este caminho ainda não existe.</h2><p>Volte à visão geral para explorar seu espaço.</p><a className="button button-dark" href="#/inicio">Voltar ao início</a></section>}
      </main>
    </div>
    {roadmap && <Roadmap onClose={() => setRoadmap(false)} />}
    {creating && <CreateContent close={() => setCreating(false)} choose={startContent} />}
    {page !== 'radar' && <Suspense fallback={null}><Assistant page={page} /></Suspense>}
  </div></AssistantSignals.Provider>
}

function HomeGuidance({ importContent }: { importContent: () => void }) {
  useAssistantSignal({
    area: 'inicio', scope: 'inicio', category: 'production', priority: 1, proactive: false,
    insight: { id: 'importar', title: 'Importe seu conteúdo para começar', detail: 'Cole o texto ou escolha um arquivo JSON ou Markdown.',
      assessment: 'heuristic', actions: [{ label: 'Importar conteúdo', run: importContent }] },
  })
  return null
}
