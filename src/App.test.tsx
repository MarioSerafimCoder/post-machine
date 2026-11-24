import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

function navigate(hash: string) { act(() => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')) }) }
beforeEach(() => { window.location.hash = '' })
describe('fundação', () => {
  it('apresenta os três espaços e identifica o Radar disponível', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'O que vamos criar hoje?' })).toBeVisible()
    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(navigation).getAllByRole('link')).toHaveLength(4)
    expect(within(screen.getByRole('group', { name: 'Origens do carrossel' })).getAllByRole('button')).toHaveLength(3)
  })
  it('atualiza página, título e foco; alterna seções do Radar', async () => {
    render(<App />); navigate('#/radar')
    expect(document.title).toBe('Radar — Post Machine')
    expect(screen.getByRole('heading', { name: 'Radar' })).toHaveFocus()
    expect(await screen.findByRole('region', { name: 'Notícias do Radar' }, { timeout: 4000 })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Virais e formatos' }))
    expect(screen.getByRole('region', { name: 'Virais e formatos' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Ver catálogo de formatos' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Virais e formatos' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('exibe recuperação para rota desconhecida', () => {
    render(<App />); navigate('#/nao-existe')
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '#/inicio')
  })
})
