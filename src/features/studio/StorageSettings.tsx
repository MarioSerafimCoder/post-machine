import { useState } from 'react'
import { inspectStorage } from './storage'

const bytes = (value: number) => `${value.toLocaleString('pt-BR')} bytes`

export function StorageSettings({ flush }: { flush: () => Promise<void> }) {
  const [report, setReport] = useState<Awaited<ReturnType<typeof inspectStorage>>>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function check(clean = false) {
    if (clean && !window.confirm('Excluir os arquivos sem referência encontrados na nova verificação?')) return
    setBusy(true)
    setMessage('')
    try {
      await flush()
      const result = await inspectStorage(clean)
      if (clean) setMessage(`${result.orphans} arquivos removidos, totalizando ${bytes(result.recoverableBytes)}.`)
      setReport(clean ? await inspectStorage() : result)
    } catch {
      setReport(undefined)
      setMessage('Não foi possível confirmar a integridade do armazenamento ou concluir a operação.')
    } finally { setBusy(false) }
  }
  async function resetPhotos() {
    if (!window.confirm('Limpar o acervo temporário de pesquisa visual?')) return
    setBusy(true)
    setMessage('')
    try {
      const { resetVisualMemory } = await import('../images/searchOrchestrator')
      await resetVisualMemory()
      setMessage('Acervo temporário de pesquisa visual limpo.')
    } catch { setMessage('Não foi possível limpar o acervo de pesquisa visual.') }
    finally { setBusy(false) }
  }
  return <details><summary>Configurações de armazenamento</summary>
    <button disabled={busy} onClick={() => void check()}>Verificar armazenamento</button>
    <button disabled={busy} onClick={() => void resetPhotos()}>Limpar memória de pesquisa visual</button>
    {message && <p role="status">{message}</p>}
    {report && <div aria-label="Relatório de armazenamento">
      <p>{report.projects} projetos · {report.assets} arquivos de imagem ou fonte · {bytes(report.bytes)} em arquivos.</p>
      <p>{report.orphans} arquivos sem referência · {bytes(report.recoverableBytes)} recuperáveis.</p>
      <button disabled={busy || !report.orphans} onClick={() => void check(true)}>Limpar arquivos órfãos</button>
    </div>}
  </details>
}
