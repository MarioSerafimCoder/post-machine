import type { CampaignStartMode } from './features/campaigns/CampaignStart'
import type { Draft } from './features/campaigns/contract'
import { lazy, Suspense } from 'react'
const Studio = lazy(() => import('./features/studio/Studio').then(module => ({ default: module.Studio })))
const Radar = lazy(() => import('./features/radar/Radar').then(module => ({ default: module.Radar })))
const AuditPage = lazy(() => import('./features/audit/AuditPage').then(module => ({ default: module.AuditPage })))
import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { Roadmap } from './components/Roadmap'
import { usePage, type Page } from './lib/navigation'

const nav: { id: Page; label: string; icon: IconName }[] = [
  { id: 'inicio', label: 'Visão geral', icon: 'home' }, { id: 'radar', label: 'Radar', icon: 'radar' },
  { id: 'studio', label: 'Studio', icon: 'studio' }, { id: 'auditoria', label: 'Auditoria', icon: 'audit' },
]
const modules: { id: Page; number: string; title: string; description: string; icon: IconName; label: string }[] = [
  { id: 'radar', number: '01', title: 'Encontre a próxima pauta.', description: 'Notícias, tendências e referências para começar com uma boa ideia.', icon: 'radar', label: 'Explorar Radar' },
  { id: 'studio', number: '02', title: 'Dê forma ao conteúdo.', description: 'Um espaço para transformar ideias em posts e carrosséis com a sua identidade.', icon: 'studio', label: 'Conhecer Studio' },
  { id: 'auditoria', number: '03', title: 'Revise cada detalhe.', description: 'Margens, contraste e legibilidade. Um olhar técnico antes de exportar.', icon: 'audit', label: 'Conhecer Auditoria' },
]

export function App() {
  const page = usePage()
  const [visited, setVisited] = useState({ studio: false, radar: false })
  const [radarStart, setRadarStart] = useState<{ mode: CampaignStartMode }>()
  useEffect(() => {
    if (page !== 'studio' && page !== 'radar') return
    const timer = setTimeout(() => setVisited(current => current[page] ? current : { ...current, [page]: true }), 0)
    return () => clearTimeout(timer)
  }, [page])
  const [designRequest, setDesignRequest] = useState<Draft | null>(null)
  const [roadmap, setRoadmap] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const label = nav.find(item => item.id === page)?.label ?? 'Página não encontrada'
  const previousLabel = useRef(label)
  useEffect(() => {
    document.title = `${label} — Post Machine`
    if (previousLabel.current !== label) heading.current?.focus()
    previousLabel.current = label
  }, [label])
  return <><section className="desktop-required" aria-label="Disponível somente para desktop"><span className="brand-mark" aria-hidden="true">PM</span><h1>Um espaço para criar no desktop.</h1><p>O Post Machine foi feito exclusivamente para computadores. Abra em um desktop ou amplie a janela para pelo menos 1024 px.</p><span className="badge badge-green">Desktop first. Sempre.</span></section><div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Pular para o conteúdo</a>
    <div className="main-shell">
      <header className="topbar">
        <a className="brand" href="#/inicio" aria-label="Post Machine — início"><span className="brand-mark">PM</span><span>Post Machine</span></a>
        <nav className="primary-nav" aria-label="Navegação principal">{nav.map(item =>
          <a key={item.id} className="nav-link" href={`#/${item.id}`} aria-current={page === item.id ? 'page' : undefined}>
            <Icon name={item.icon} /><span>{item.id === 'inicio' ? 'Início' : item.label}</span>
          </a>
        )}</nav>
        <button className="text-button" onClick={() => setRoadmap(true)}><Icon name="book" /><span>Roteiro do produto</span></button>
      </header>
      <main id="main-content" className={page === 'inicio' ? 'home-workspace' : 'active-workspace'} tabIndex={-1}>
        <h1 ref={heading} tabIndex={-1}>{page === 'inicio' ? 'Ideias boas merecem espaço.' : label}</h1>
        {page === 'inicio' && <Overview onRoadmap={() => setRoadmap(true)} />}
        {(page === 'radar' || visited.radar) && <div hidden={page !== 'radar'}><Suspense fallback={<p role="status">Carregando o Radar…</p>}>
          <Radar active={page === 'radar'} start={radarStart} onDesign={draft => { setDesignRequest(draft); window.location.hash = '/studio' }} />
        </Suspense></div>}
        {(page === 'studio' || visited.studio) && <div hidden={page !== 'studio'}><Suspense fallback={<p>Carregando Studio…</p>}><Studio request={designRequest} active={page === 'studio'} onStartCampaign={mode => { setRadarStart({ mode }); window.location.hash = '/radar' }} /></Suspense></div>}
        {page === 'auditoria' && <Suspense fallback={<p>Carregando auditoria…</p>}><AuditPage /></Suspense>}
        {page === 'not-found' && <section className="empty-state"><Icon name="home" /><h2>Este caminho ainda não existe.</h2><p>Volte à visão geral para explorar seu espaço.</p><a className="button button-dark" href="#/inicio">Voltar ao início</a></section>}
      </main>
    </div>
    {roadmap && <Roadmap onClose={() => setRoadmap(false)} />}
  </div></>
}

function Overview({ onRoadmap }: { onRoadmap: () => void }) {
  return <>
    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">MENOS DISPERSÃO. MAIS CRIAÇÃO.</p><h2 id="hero-title">Da primeira referência<br />ao último detalhe.</h2><p>Descubra pautas, dê forma às ideias e revise suas artes.<br className="desktop-break" /> Seu fluxo de conteúdo começa aqui.</p><a className="button button-lime" href="#/radar">Conhecer o Radar <Icon name="arrow" /></a><span className="hero-caption">Radar, campanhas e Studio disponíveis</span></div><div className="hero-art" role="img" aria-label="Composição editorial ilustrativa: da ideia à forma"><div className="art-grid" /><div className="poster poster-back"><span>POST / 002</span><div className="orb" /><strong>Um novo<br />ponto de vista.</strong><span>EXPLORE OUTRAS PERSPECTIVAS ↗</span></div><div className="poster poster-front"><span>IDEIA EM MOVIMENTO <i>↗</i></span><strong>Crie.<br />Com<br /><em>intenção.</em></strong><div className="poster-bottom"><span>POST MACHINE<br />ESTUDO VISUAL</span><span>01—03</span></div></div><span className="art-label">EXPLORAÇÃO VISUAL / 001</span></div></section>
    <section aria-labelledby="flow-title"><div className="section-heading"><div><p className="eyebrow">UM FLUXO, TRÊS MOMENTOS</p><h2 id="flow-title">Seu próximo conteúdo começa com uma ideia.</h2></div><span className="small muted">Conheça os espaços</span></div><div className="module-grid">{modules.map(item => <a className="module-card" href={`#/${item.id}`} key={item.id}><div className="flex items-center justify-between"><span className={`module-icon ${item.id}`}><Icon name={item.icon} /></span><span className="module-number">{item.number}</span></div><span className="module-name">{item.id === 'auditoria' ? 'AUDITORIA' : item.id.toUpperCase()}</span><h3>{item.title}</h3><p>{item.description}</p><span className="card-action">{item.label}<Icon name="arrow" /></span></a>)}</div></section>
    <section className="workspace-panel" aria-labelledby="workspace-title"><div><p className="eyebrow">UM ESPAÇO QUE CRESCE COM VOCÊ</p><h2 id="workspace-title">Tudo pronto para começar a construir.</h2><p>A navegação está disponível. Use o Radar para encontrar notícias e organizar suas campanhas. Abra a campanha no Studio para editar, auditar e exportar suas artes.</p><button className="text-button inline-action" onClick={onRoadmap}>Acompanhar as próximas etapas <Icon name="arrow" /></button></div><div className="privacy-note"><Icon name="shield" /><strong>Seu trabalho fica com você.</strong><p>Pautas e campanhas ficam salvas neste navegador. Use um backup para levar seu trabalho a outro dispositivo.</p><span className="badge">Armazenamento local</span></div></section>
  </>
}
