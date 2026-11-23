import { describe, expect, it } from 'vitest'
import { rankPhotographs, visualQueries } from './automaticSearch'
import { responseSchema, type ImageResult } from './contract'

const photo = (patch: Partial<ImageResult> = {}): ImageResult => responseSchema.parse({ page_count: 1, results: [{
  id: '762ec81b-3312-40d6-8ce2-e70aa6b43465', title: 'Ponte da arquitetura urbana', creator: 'Autoria da fixture',
  category: 'photograph', url: 'https://upload.wikimedia.org/original.jpg',
  foreign_landing_url: 'https://commons.wikimedia.org/wiki/File:Original.jpg', width: 1400, height: 1000,
  license: 'by', license_url: 'https://creativecommons.org/licenses/by/4.0/', license_version: '4.0', ...patch,
}] }).results[0]

describe('política visual automática', () => {
  const query = visualQueries({ title: 'Ponte e arquitetura urbana', imageBrief: 'Fotografia de ponte e arquitetura', body: 'Vista do bairro.' })!
  it('prioriza a consulta factual e usa apoio fotográfico apenas na última camada', () => {
    expect(query.stages.map(stage => stage.strategy)).toEqual(['documental', 'documental-expandida', 'editorial'])
    expect(query.stages[1].query).toContain('bridge')
    expect(visualQueries({ title: 'Arquitetura urbana', imageBrief: 'Sem fotografia nesta peça' })).toBeUndefined()
    expect(visualQueries({ title: 'Comparar opções', role: 'comparison' })).toBeUndefined()
    expect(visualQueries({ title: 'Arquitetura urbana', imageBrief: 'Ilustração conceitual de futuro' })?.stages[0].query).not.toMatch(/conceitual|ilustracao/)
  })
  it('exige indícios documentais, pertinência e licença para adaptação', () => {
    const stock = photo({ title: 'Ponte arquitetura, stock photo' })
    expect(rankPhotographs([stock, photo()], query, 'documental', new Set()).map(item => item.result.title)).toEqual(['Ponte da arquitetura urbana'])
    expect(rankPhotographs([stock], query, 'editorial', new Set())).toHaveLength(1)
    expect(rankPhotographs([
      photo({ category: 'illustration' }), photo({ title: 'Ponte arquitetura, AI generated' }),
      photo({ title: 'Pássaro no telhado' }), photo({ license: 'by-nd', license_url: 'https://creativecommons.org/licenses/by-nd/4.0/' }),
      photo({ width: 240 }),
    ], query, 'editorial', new Set())).toHaveLength(0)
    expect(rankPhotographs([photo()], query, 'documental', new Set([photo().url!]))).toHaveLength(0)
  })
  it('usa um evento mencionado no corpo apenas como apoio editorial', () => {
    const visual = visualQueries({ title: 'A seguradora fez um filme de Natal. Por quê?',
      body: 'A estreia acontece no desfile da Macy’s.' })!
    const context = visual.stages.at(-1)!
    expect(context).toMatchObject({ strategy: 'editorial', query: 'macys thanksgiving day parade' })
    const archive = photo({ title: 'Macy’s Thanksgiving Day Parade 2022' })
    const unrelated = photo({ title: 'Thanksgiving parade in Plymouth' })
    const wrongLicense = photo({ title: archive.title, license: 'by-nd', license_url: 'https://creativecommons.org/licenses/by-nd/4.0/' })
    expect(rankPhotographs([archive], visual, 'documental', new Set())).toHaveLength(0)
    expect(rankPhotographs([archive, unrelated, wrongLicense], visual, 'editorial', new Set(), context)).toHaveLength(1)
  })
  it('separa a técnica de animação de usos fotográficos de stop motion', () => {
    const visual = visualQueries({ title: 'A animação artesanal faz parte da proposta' })!
    const context = visual.stages.at(-1)!
    const movie = photo({ title: 'Stop-motion animation behind the scenes' })
    const waterfall = photo({ title: 'Waterfall captured with stop motion' })
    expect(rankPhotographs([movie, waterfall], visual, 'editorial', new Set(), context).map(item => item.result.title)).toEqual([movie.title])
  })
})
