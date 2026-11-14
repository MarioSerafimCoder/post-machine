import { Campaigns } from './features/campaigns/Campaigns'
import type { Article } from './features/radar/contract'
import { News } from './features/radar/News'
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
  const [roadmap, setRoadmap] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const label = nav.find(item => item.id === page)?.label ?? 'Página não encontrada'
  const previousLabel = useRef(label)
  useEffect(() => {
    document.title = `${label} — Post Machine`
    if (previousLabel.current !== label) heading.current?.focus()
    previousLabel.current = label
  }, [label])
  return <><section className="desktop-required" aria-label="Disponível somente para desktop"><span className="brand-mark" aria-hidden="true">p<span>m</span></span><h1>Um espaço para criar no desktop.</h1><p>O Post Machine foi feito exclusivamente para computadores. Abra em um desktop ou amplie a janela para pelo menos 1024 px.</p><span className="badge badge-green">Desktop first. Sempre.</span></section><div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Pular para o conteúdo</a>
    <aside className="sidebar">
      <a className="brand" href="#/inicio" aria-label="Post Machine — início"><span className="brand-mark">p<span>m</span></span><span>post machine<span className="brand-subtitle">SEU ESPAÇO DE CRIAÇÃO</span></span></a>
      <div className="workspace-label">WORKSPACE <span>PESSOAL</span></div>
      <nav aria-label="Navegação principal">{nav.map(item => <a key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} href={`#/${item.id}`} aria-current={page === item.id ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span>{page === item.id && <span className="active-dot" />}</a>)}</nav>
      <div className="sidebar-bottom"><div className="foundation-note"><span className="status-dot" /><strong>Uma boa base, primeiro.</strong><p>Estamos preparando seu próximo espaço de criação.</p><button onClick={() => setRoadmap(true)}>Ver roteiro do produto <Icon name="arrow" /></button></div><div className="profile"><span className="avatar">MS</span><div><strong>Meu espaço</strong><span>Uso pessoal · versão 0.1</span></div></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{label}</strong></div><button className="text-button" onClick={() => setRoadmap(true)}><Icon name="book" /><span>Roteiro do produto</span></button></header>
      <main id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><p className="eyebrow">SEU PROCESSO CRIATIVO, EM UM SÓ LUGAR</p><h1 ref={heading} tabIndex={-1}>{page === 'inicio' ? 'Ideias boas merecem espaço.' : label}</h1></div><span className="badge badge-outline"><span className="status-dot" /> Fase 2 · Pautas e campanhas</span></div>
        {page === 'inicio' && <Overview onRoadmap={() => setRoadmap(true)} />}
        {page === 'radar' && <Radar />}
        {page === 'studio' && <Studio />}
        {page === 'auditoria' && <Audit />}
        {page === 'not-found' && <section className="empty-state"><Icon name="home" /><h2>Este caminho ainda não existe.</h2><p>Volte à visão geral para explorar seu espaço.</p><a className="button button-dark" href="#/inicio">Voltar ao início</a></section>}
        <footer className="footer"><span>POST MACHINE <span className="footer-divider">/</span> Da referência à publicação.</span><span>Feito para o seu processo.</span></footer>
      </main>
    </div>
    {roadmap && <Roadmap onClose={() => setRoadmap(false)} />}
  </div></>
}

function Overview({ onRoadmap }: { onRoadmap: () => void }) {
  return <>
    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">MENOS DISPERSÃO. MAIS CRIAÇÃO.</p><h2 id="hero-title">Da primeira referência<br />ao último detalhe.</h2><p>Descubra pautas, dê forma às ideias e revise suas artes.<br className="desktop-break" /> Seu fluxo de conteúdo começa aqui.</p><a className="button button-lime" href="#/radar">Conhecer o Radar <Icon name="arrow" /></a><span className="hero-caption">Radar e campanhas disponíveis</span></div><div className="hero-art" role="img" aria-label="Composição editorial ilustrativa: da ideia à forma"><div className="art-grid" /><div className="poster poster-back"><span>POST / 002</span><div className="orb" /><strong>Um novo<br />ponto de vista.</strong><span>EXPLORE OUTRAS PERSPECTIVAS ↗</span></div><div className="poster poster-front"><span>IDEIA EM MOVIMENTO <i>↗</i></span><strong>Crie.<br />Com<br /><em>intenção.</em></strong><div className="poster-bottom"><span>POST MACHINE<br />ESTUDO VISUAL</span><span>01—03</span></div></div><span className="art-label">EXPLORAÇÃO VISUAL / 001</span></div></section>
    <section aria-labelledby="flow-title"><div className="section-heading"><div><p className="eyebrow">UM FLUXO, TRÊS MOMENTOS</p><h2 id="flow-title">Seu próximo conteúdo começa com uma ideia.</h2></div><span className="small muted">Conheça os espaços</span></div><div className="module-grid">{modules.map(item => <a className="module-card" href={`#/${item.id}`} key={item.id}><div className="flex items-center justify-between"><span className={`module-icon ${item.id}`}><Icon name={item.icon} /></span><span className="module-number">{item.number}</span></div><span className="module-name">{item.id === 'auditoria' ? 'AUDITORIA' : item.id.toUpperCase()}</span><h3>{item.title}</h3><p>{item.description}</p><span className="card-action">{item.label}<Icon name="arrow" /></span></a>)}</div></section>
    <section className="workspace-panel" aria-labelledby="workspace-title"><div><p className="eyebrow">UM ESPAÇO QUE CRESCE COM VOCÊ</p><h2 id="workspace-title">Tudo pronto para começar a construir.</h2><p>A navegação está disponível. Use o Radar para encontrar notícias e organizar suas campanhas. O editor visual e a revisão de artes estão previstos nas próximas etapas.</p><button className="text-button inline-action" onClick={onRoadmap}>Acompanhar as próximas etapas <Icon name="arrow" /></button></div><div className="privacy-note"><Icon name="shield" /><strong>Seu trabalho fica com você.</strong><p>Pautas e campanhas ficam salvas neste navegador. Use um backup para levar seu trabalho a outro dispositivo.</p><span className="badge">Armazenamento local</span></div></section>
  </>
}

const radarSections = [
  { title: 'Notícias e pautas' },
  { title: 'Pautas e prompts' },
  { title: 'Virais e formatos', heading: 'Referências que ampliam o repertório.', description: 'A curadoria manual de formatos e referências criativas será implementada na Fase 5.', note: 'Nenhuma referência cadastrada. Métricas nunca serão inventadas.' },
]
function Radar() {
  const [section, setSection] = useState(0)
  const [request, setRequest] = useState<{ article: Article } | null>(null)
  const newsTab = useRef<HTMLButtonElement>(null)
  const draftsTab = useRef<HTMLButtonElement>(null)
  const current = radarSections[section]

  function selectArticle(article: Article) {
    setRequest({ article })
    setSection(1)
    draftsTab.current?.focus()
  }
  return <><p className="page-description">Um lugar para descobrir, conectar e guardar boas referências.</p><div className="segmented" role="group" aria-label="Seções do Radar">{radarSections.map((item, index) => <button key={item.title} ref={index === 0 ? newsTab : index === 1 ? draftsTab : undefined} aria-pressed={section === index} onClick={() => setSection(index)}>{item.title}</button>)}</div><div hidden={section !== 0}><News onCreatePost={selectArticle} /></div><div hidden={section !== 1}><Campaigns request={request} active={section === 1} onBack={() => { setSection(0); newsTab.current?.focus() }} /></div>{section === 2 && <section className="empty-state" aria-live="polite"><span className="empty-icon"><Icon name="radar" /></span><span className="badge">Em desenvolvimento</span><h2>{current.heading}</h2><p>{current.description}</p><span className="small muted">{current.note}</span></section>}<div className="info-strip"><Icon name="shield" /><p>Fontes verificáveis, links originais e datas reais. Sem conteúdo inventado.</p></div></>
}
function Studio() {
  return <><p className="page-description">Ideias com forma, ritmo e identidade.</p><section className="empty-state"><span className="empty-icon"><Icon name="studio" /></span><span className="badge">Planejado · Fase 3</span><h2>Seu próximo carrossel começa aqui.</h2><p>O editor visual ainda não está disponível. A próxima etapa do Studio trará templates editáveis, projetos locais e exportação.</p><a className="button button-dark" href="#/radar">Conhecer o Radar <Icon name="arrow" /></a></section><div className="format-panel"><h2>Formatos previstos</h2><div className="format-grid">{[['portrait', 'Retrato', '1080 × 1350'], ['square', 'Quadrado', '1080 × 1080'], ['story', 'Story', '1080 × 1920']].map(([shape, title, size]) => <div className="format-item" key={shape}><div className="format-preview"><span className={`format-shape ${shape}`} /></div><div><strong>{title}</strong><p>{size} px</p></div><span className="badge">Planejado</span></div>)}</div></div></>
}
function Audit() {
  return <><p className="page-description">Um olhar atento antes de compartilhar.</p><section className="empty-state"><span className="empty-icon"><Icon name="audit" /></span><span className="badge">Planejado · Fase 4</span><h2>Cada detalhe faz diferença.</h2><p>A auditoria ficará disponível após o editor. Nenhuma arte foi analisada e nenhum resultado está sendo simulado.</p><a className="button button-dark" href="#/studio">Conhecer o Studio <Icon name="arrow" /></a></section><div className="audit-grid">{[['Limites e margens', 'Textos e elementos dentro das áreas seguras.'], ['Imagens e tipografia', 'Resolução, fontes e legibilidade dos conteúdos.'], ['Consistência visual', 'Formatos, branding e campos obrigatórios.']].map(([title, text]) => <article className="audit-card" key={title}><span className="eyebrow">VERIFICAÇÃO PLANEJADA</span><h3>{title}</h3><p>{text}</p></article>)}</div></>
}
