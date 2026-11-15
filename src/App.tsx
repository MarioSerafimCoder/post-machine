import { CampaignStart, type CampaignStartMode } from './features/campaigns/CampaignStart'
import type { Draft } from './features/campaigns/contract'
import { lazy, Suspense } from 'react'
const Studio = lazy(() => import('./features/studio/Studio').then(module => ({ default: module.Studio })))
const AuditPage = lazy(() => import('./features/audit/AuditPage').then(module => ({ default: module.AuditPage })))
import { Campaigns } from './features/campaigns/Campaigns'
import type { Article } from './features/radar/contract'
import { News } from './features/radar/News'
import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './components/Icon'
import { FormatCatalog } from './features/virals/FormatCatalog'
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
  const [studioVisited, setStudioVisited] = useState(false)
  useEffect(() => { if (page === 'studio') { const timer = setTimeout(() => setStudioVisited(true), 0); return () => clearTimeout(timer) } }, [page])
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
    <aside className="sidebar">
      <a className="brand" href="#/inicio" aria-label="Post Machine — início"><span className="brand-mark">PM</span><span>Post Machine<span className="brand-subtitle">SEU ESPAÇO DE CRIAÇÃO</span></span></a>
      <div className="workspace-label">POST MACHINE <span>PESSOAL</span></div>
      <nav aria-label="Navegação principal">{nav.map(item => <a key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} href={`#/${item.id}`} aria-current={page === item.id ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span>{page === item.id && <span className="active-dot" />}</a>)}</nav>
      <div className="sidebar-bottom"><div className="foundation-note"><span className="status-dot" /><strong>Da pauta ao design.</strong><p>Radar, campanhas e Studio no seu espaço de criação.</p><button onClick={() => setRoadmap(true)}>Ver roteiro do produto <Icon name="arrow" /></button></div><div className="profile"><span className="avatar">MS</span><div><strong>Meu espaço</strong><span>Uso pessoal · versão 0.1</span></div></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{label}</strong></div><button className="text-button" onClick={() => setRoadmap(true)}><Icon name="book" /><span>Roteiro do produto</span></button></header>
      <main id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><p className="eyebrow">SEU PROCESSO CRIATIVO, EM UM SÓ LUGAR</p><h1 ref={heading} tabIndex={-1}>{page === 'inicio' ? 'Ideias boas merecem espaço.' : label}</h1></div><span className="badge badge-outline"><span className="status-dot" /> Fase 5 · Ferramentas editoriais</span></div>
        {page === 'inicio' && <Overview onRoadmap={() => setRoadmap(true)} />}
        <div hidden={page !== 'radar'}><Radar active={page === 'radar'} onDesign={draft => { setDesignRequest(draft); window.location.hash = '/studio' }} /></div>
        {(page === 'studio' || studioVisited) && <div hidden={page !== 'studio'}><Suspense fallback={<p>Carregando Studio…</p>}><Studio request={designRequest} /></Suspense></div>}
        {page === 'auditoria' && <Suspense fallback={<p>Carregando auditoria…</p>}><AuditPage /></Suspense>}
        {page === 'not-found' && <section className="empty-state"><Icon name="home" /><h2>Este caminho ainda não existe.</h2><p>Volte à visão geral para explorar seu espaço.</p><a className="button button-dark" href="#/inicio">Voltar ao início</a></section>}
        <footer className="footer"><span>POST MACHINE <span className="footer-divider">/</span> Da referência à publicação.</span><span>Feito para o seu processo.</span></footer>
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

const radarSections = [
  { title: 'Notícias e pautas' },
  { title: 'Pautas e prompts' },
  { title: 'Virais e formatos' },
]
function Radar({ active, onDesign }: { active: boolean; onDesign: (draft: Draft) => void }) {
  const [section, setSection] = useState(0)
  const [request, setRequest] = useState<{ article: Article | null } | null>(null)
  const newsTab = useRef<HTMLButtonElement>(null)
  const draftsTab = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const start = (event: Event) => { const mode = (event as CustomEvent<CampaignStartMode>).detail; if (mode === 'radar') setSection(0); else { setRequest({ article: null }); setSection(1) } }
    window.addEventListener('direto:new-campaign', start); return () => window.removeEventListener('direto:new-campaign', start)
  }, [])

  function selectArticle(article: Article) {
    setRequest({ article })
    setSection(1)
    draftsTab.current?.focus()
  }
  return <><CampaignStart choose={mode => { if (mode === 'radar') setSection(0); else { setRequest({ article: null }); setSection(1) } }} /><p className="page-description">Um lugar para descobrir, conectar e guardar boas referências.</p><div className="segmented" role="group" aria-label="Seções do Radar">{radarSections.map((item, index) => <button key={item.title} ref={index === 0 ? newsTab : index === 1 ? draftsTab : undefined} aria-pressed={section === index} onClick={() => setSection(index)}>{item.title}</button>)}</div><div hidden={section !== 0}><News onCreatePost={selectArticle} /></div><div hidden={section !== 1}><Campaigns onDesign={onDesign} request={request} active={active && section === 1} onBack={() => { setSection(0); newsTab.current?.focus() }} /></div>{section === 2 && <FormatCatalog />}<div className="info-strip"><Icon name="shield" /><p>Fontes verificáveis, links originais e datas reais. Sem conteúdo inventado.</p></div></>
}
