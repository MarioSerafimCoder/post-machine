import { describe, expect, it } from 'vitest'
import { duplicates, librarySchema, newReference } from './contract'
import { editorialPrompt } from './editorial'
import { identifyUrl } from './urls'

describe('biblioteca de referências', () => {
  it.each([
    ['https://youtu.be/abcdefghijk', 'youtube'], ['https://instagram.com/reel/a1b2', 'instagram'],
    ['https://www.tiktok.com/@autor/video/12345', 'tiktok'], ['https://pin.it/abc', 'pinterest'],
    ['https://www.behance.net/gallery/123456/Projeto', 'behance'], ['https://dribbble.com/shots/1234-Estudo', 'dribbble'],
    ['https://example.com/blog', 'web'],
  ])('identifica a plataforma de %s', (url, platform) => expect(identifyUrl(url).platform).toBe(platform))
  it('rejeita esquema inseguro, credenciais e URL de canal', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,teste', 'https://user:pass@example.com', 'https://www.youtube.com/@canal']) expect(() => identifyUrl(url)).toThrow()
  })
  it('deduplica IDs e URLs canônicas sem confundir plataformas', () => {
    const one = { ...newReference(), url: 'https://youtu.be/abcdefghijk?si=a' }
    expect(duplicates(one, { ...one, url: 'https://youtube.com/shorts/abcdefghijk' })).toBe(true)
    expect(duplicates(one, { ...one, url: 'https://instagram.com/reel/abcdefghijk' })).toBe(false)
    expect(duplicates({ ...one, url: 'https://example.com/post/?utm_source=a' }, { ...one, url: 'https://example.com/post' })).toBe(true)
  })
  it('valida backup e separa ausência de contexto de uma análise observada', () => {
    const ref = { ...newReference(), title: 'Exemplo da fixture', url: 'https://example.com/post' }
    expect(librarySchema.safeParse({ schemaVersion: 1, references: [ref] }).success).toBe(true)
    expect(librarySchema.safeParse({ schemaVersion: 2, references: [ref] }).success).toBe(false)
    expect(editorialPrompt(ref)).toContain('solicite ao usuário')
    expect(editorialPrompt({ ...ref, analysis: { ...ref.analysis, hook: 'Contraste entre duas opções' } })).toContain('Contraste entre duas opções')
  })
})
