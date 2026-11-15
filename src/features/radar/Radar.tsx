import { useRef, useState } from 'react'
import { CampaignStart, type CampaignStartMode } from '../campaigns/CampaignStart'
import { Campaigns } from '../campaigns/Campaigns'
import type { Draft } from '../campaigns/contract'
import { Virals } from '../virals/Virals'
import type { Reference } from '../virals/contract'
import { Icon } from '../../components/Icon'
import { News } from './News'
import type { Article } from './contract'

const radarSections = [
  { title: 'Notícias e pautas' },
  { title: 'Pautas e prompts' },
  { title: 'Virais e formatos' },
]
export function Radar({ active, start, onDesign }: { active: boolean; start?: { mode: CampaignStartMode }; onDesign: (draft: Draft) => void }) {
  const [section, setSection] = useState(0)
  const [request, setRequest] = useState<{ article: Article | null; reference?: Reference } | null>(null)
  const newsTab = useRef<HTMLButtonElement>(null)
  const draftsTab = useRef<HTMLButtonElement>(null)
  const referencesTab = useRef<HTMLButtonElement>(null)
  const [handledStart, setHandledStart] = useState<typeof start>()
  const [viralsVisited, setViralsVisited] = useState(false)
  if (start && start !== handledStart) {
    setHandledStart(start)
    setSection(start.mode === 'radar' ? 0 : 1)
    if (start.mode !== 'radar') setRequest({ article: null })
  }

  function selectArticle(article: Article) {
    setRequest({ article })
    setSection(1)
    draftsTab.current?.focus()
  }
  function showSection(index: number) {
    setSection(index)
    if (index === 2) setViralsVisited(true)
  }

  return <>
    <CampaignStart choose={mode => {
      if (mode === 'radar') { showSection(0); newsTab.current?.focus() }
      else { setRequest({ article: null }); showSection(1); draftsTab.current?.focus() }
    }} />
    <div className="segmented" role="group" aria-label="Seções do Radar">
      {radarSections.map((item, index) => <button key={item.title}
        ref={index === 0 ? newsTab : index === 1 ? draftsTab : referencesTab}
        aria-pressed={section === index} onClick={() => showSection(index)}>{item.title}</button>)}
    </div>
    <div hidden={section !== 0}><News onCreatePost={selectArticle} /></div>
    <div hidden={section !== 1}><Campaigns onDesign={onDesign} request={request} active={active && section === 1}
      onBack={references => { showSection(references ? 2 : 0); (references ? referencesTab : newsTab).current?.focus() }} /></div>
    {viralsVisited && <div hidden={section !== 2}><Virals createCampaign={reference => {
      setRequest({ article: null, reference })
      showSection(1)
      draftsTab.current?.focus()
    }} /></div>}
    <div className="info-strip"><Icon name="shield" /><p>Fontes verificáveis, links originais e datas reais. Sem conteúdo inventado.</p></div>
  </>
}
