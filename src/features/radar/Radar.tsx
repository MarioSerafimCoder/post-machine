import { useEffect, useRef, useState } from 'react'
import type { CampaignEntry } from '../campaigns/CampaignStart'
import { Campaigns, type CampaignRequest } from '../campaigns/Campaigns'
import type { DesignMode, Draft } from '../campaigns/contract'
import { openArticleCampaign } from '../campaigns/storage'
import { resolvePage } from '../../lib/navigation'
import { Virals } from '../virals/Virals'
import { ContextRail, ContextWorkspace, type ContextTool } from '../../components/ContextRail'
import Assistant from '../intelligence/Assistant'
import { News } from './News'
import type { Article } from './contract'

const radarSections: ContextTool[] = [
  { label: 'Notícias e pautas', icon: 'news' },
  { label: 'Pautas e prompts', icon: 'text' },
  { label: 'Virais e formatos', icon: 'book' },
  { label: 'Oportunidades', icon: 'spark' }, { label: 'Favoritos', icon: 'star' },
]
export function Radar({ active, start, onDesign }: { active: boolean; start?: CampaignEntry; onDesign: (draft: Draft, mode?: DesignMode) => void }) {
  const [section, setSection] = useState(() => window.history.state?.campaignId && window.history.state?.campaignOpen ? 1 : 0)
  const [request, setRequest] = useState<CampaignRequest | null>(null)
  const opening = useRef(false)
  const [preparing, setPreparing] = useState(false)
  const [openError, setOpenError] = useState(false)
  useEffect(() => {
    if (active) window.history.replaceState({ ...window.history.state, campaignOpen: section === 1 }, '')
  }, [active, section])
  const rail = useRef<HTMLDivElement>(null)


  const [handledStart, setHandledStart] = useState<typeof start>()
  const [viralsVisited, setViralsVisited] = useState(false)
  if (start && start !== handledStart) {
    setHandledStart(start)
    setSection(start.mode === 'radar' ? 0 : 1)
    if (start.mode !== 'radar') setRequest(start.campaignId ? { campaignId: start.campaignId } : { article: null })
  }

  function focusTool(index: number) { rail.current?.querySelectorAll<HTMLButtonElement>("nav button")[index]?.focus() }
  async function selectArticle(article: Article) {
    if (opening.current) return
    opening.current = true
    setPreparing(true)
    setOpenError(false)
    try {
      const draft = await openArticleCampaign(article)
      if (resolvePage(window.location.hash) === 'radar') {
        setRequest({ campaignId: draft.id })
        onDesign(draft, 'radar')
      }
    } catch { setOpenError(true) }
    finally { opening.current = false; setPreparing(false) }
  }
  function showSection(index: number) {
    setSection(index)
    if (index === 2) setViralsVisited(true)
  }

  return <div ref={rail}><ContextWorkspace rail={
    <ContextRail label="Seções do Radar" tools={radarSections} selected={radarSections[section].label}
      choose={label => showSection(radarSections.findIndex(item => item.label === label))} />
  }>
    <div hidden={section === 1 || section === 2}>
    {preparing && <p role="status">Preparando a notícia para o Studio…</p>}
    {openError && <p role="alert" className="info-strip">Não foi possível preparar a notícia. Tente novamente em Criar carrossel.</p>}
    <News active={active && section !== 1 && section !== 2} favoritesView={section === 4} opportunitiesView={section === 3} onCreatePost={item => void selectArticle(item)}
      onCreateOpportunity={opportunity => { setRequest({ article: opportunity.articles[0], opportunity }); showSection(1); focusTool(1) }} /></div>
    <div hidden={section !== 1}><Campaigns onDesign={onDesign} request={request} active={active && section === 1}
      onBack={references => { const destination = references ? 2 : request && 'opportunity' in request && request.opportunity ? 3 : 0; showSection(destination); focusTool(destination) }} /></div>
    {viralsVisited && <div hidden={section !== 2}><Virals createCampaign={reference => {
      setRequest({ article: null, reference })
      showSection(1)
      focusTool(1)
    }} /></div>}
    {active && section >= 1 && section <= 3 && <Assistant page="radar" key={section} />}
  </ContextWorkspace></div>
}
