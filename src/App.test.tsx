import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

function navigate(hash: string) { act(() => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')) }) }
beforeEach(() => { window.location.hash = '' })
describe('fundação', () => {
  it('apresenta os três espaços e identifica o Radar disponível', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Ideias boas merecem espaço.' })).toBeVisible()
    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(navigation).getAllByRole('link')).toHaveLength(4)
    expect(screen.getByText(/Radar e campanhas disponíveis/)).toBeVisible()
  })
  it('atualiza página, título e foco; alterna seções do Radar', () => {
    render(<App />); navigate('#/radar')
    expect(document.title).toBe('Radar — Post Machine')
    expect(screen.getByRole('heading', { name: 'Radar' })).toHaveFocus()
    expect(screen.getByRole('region', { name: 'Notícias do Radar' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Virais e formatos' }))
    expect(screen.getByText(/Nenhuma referência cadastrada/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Virais e formatos' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('exibe recuperação para rota desconhecida', () => {
    render(<App />); navigate('#/nao-existe')
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '#/inicio')
  })
})
