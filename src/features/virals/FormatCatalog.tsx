import { formats, type FormatId } from './catalog'
import './virals.css'

export function FormatCatalog({ counts, choose }: { counts?: Partial<Record<FormatId, number>>; choose?: (id: FormatId) => void }) {
  return <section aria-label="Catálogo de formatos criativos">
    <h2>Formatos criativos</h2>
    <div className="viral-grid">{formats.map(format => <details className="viral-card" key={format.id}>
      <summary>{format.name}</summary>
      <p>{format.description}</p>
      <dl><dt>Estrutura</dt><dd>{format.structure}</dd><dt>Objetivo</dt><dd>{format.objective}</dd><dt>Quando usar</dt><dd>{format.use}</dd><dt>Nichos</dt><dd>{format.niches.join(', ')}</dd><dt>Sequência de peças</dt><dd>{format.slides}</dd></dl>
      {choose && <button type="button" onClick={() => choose(format.id)}>Ver referências ({counts?.[format.id] ?? 0})</button>}
    </details>)}</div>
  </section>
}
