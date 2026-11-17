import { useRef, useState } from 'react'
import type { CampaignStartMode } from '../campaigns/CampaignStart'
import { Campaigns } from '../campaigns/Campaigns'
import type { Draft } from '../campaigns/contract'
import { Virals } from '../virals/Virals'
import type { Reference } from '../virals/contract'
import { ContextRail, ContextWorkspace, type ContextTool } from '../../components/ContextRail'
import { News } from './News'
import type { Article, Opportunity } from './contract'

const radarSections: ContextTool[] = [
  { label: 'Notícias e pautas', icon: 'news' },
  { label: 'Pautas e prompts', icon: 'text' },
  { label: 'Virais e formatos', icon: 'book' },
  { label: 'Oportunidades', icon: 'spark' }, { label: 'Favoritos', icon: 'star' },
]
export function Radar({ active, start, onDesign }: { active: boolean; start?: { mode: CampaignStartMode }; onDesign: (draft: Draft, mode?: 'express') => void }) {
  const [section, setSection] = useState(0)
  const [request, setRequest] = useState<{ article: Article | null; reference?: Reference; opportunity?: Opportunity } | null>(null)
  const rail = useRef<HTMLDivElement>(null)


  const [handledStart, setHandledStart] = useState<typeof start>()
  const [viralsVisited, setViralsVisited] = useState(false)
  if (start && start !== handledStart) {
    setHandledStart(start)
    setSection(start.mode === 'radar' ? 0 : 1)
    if (start.mode !== 'radar') setRequest({ article: null })
  }

  function focusTool(index: number) { rail.current?.querySelectorAll<HTMLButtonElement>("nav button")[index]?.focus() }
  function selectArticle(article: Article) {
    setRequest({ article })
    setSection(1)
    focusTool(1)
  }
  function showSection(index: number) {
    setSection(index)
    if (index === 2) setViralsVisited(true)
  }

  return <div ref={rail}><ContextWorkspace rail={
    <ContextRail label="Seções do Radar" tools={radarSections} selected={radarSections[section].label}
      choose={label => showSection(radarSections.findIndex(item => item.label === label))} />
  }>
    <div hidden={section === 1 || section === 2}><News favoritesView={section === 4} opportunitiesView={section === 3} onCreatePost={selectArticle}
      onCreateOpportunity={opportunity => { setRequest({ article: opportunity.articles[0], opportunity }); showSection(1); focusTool(1) }} /></div>
    <div hidden={section !== 1}><Campaigns onDesign={onDesign} request={request} active={active && section === 1}
      onBack={references => { const destination = references ? 2 : request?.opportunity ? 3 : 0; showSection(destination); focusTool(destination) }} /></div>
    {viralsVisited && <div hidden={section !== 2}><Virals createCampaign={reference => {
      setRequest({ article: null, reference })
      showSection(1)
      focusTool(1)
    }} /></div>}
  </ContextWorkspace></div>
}
