import { describe, expect, it } from 'vitest'
import { resolvePage } from './navigation'

describe('navegação por hash', () => {
  it('abre início na ausência de rota', () => { expect(resolvePage('')).toBe('inicio'); expect(resolvePage('#/')).toBe('inicio') })
  it.each(['inicio', 'radar', 'studio', 'auditoria'])('aceita link direto para %s', page => { expect(resolvePage(`#/${page}`)).toBe(page) })
  it('não transforma rotas inválidas em páginas válidas', () => { expect(resolvePage('#/inexistente')).toBe('not-found'); expect(resolvePage('#/radar/extra')).toBe('not-found') })
})
