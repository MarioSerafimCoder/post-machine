import type { Brand } from './model'
const loaded = new Map<string, Promise<void>>()
export class LocalFontError extends Error {}
export async function loadFonts(brand: Brand) {
  await Promise.all([document.fonts.load('16px Inter'), document.fonts.load('bold 16px Inter')])
  await Promise.all(brand.fonts.map(font => {
    if (!loaded.has(font.family)) {
      const bytes = Uint8Array.from(atob(font.source.split(',')[1]), c => c.charCodeAt(0))
      const pending = new FontFace(font.family, bytes.buffer).load().then(face => { document.fonts.add(face) }).catch(() => {
        loaded.delete(font.family)
        throw new LocalFontError(`Não foi possível carregar a fonte ${font.name}. Confira o arquivo WOFF2 ou restaure o backup do projeto.`)
      })
      loaded.set(font.family, pending)
    }
    return loaded.get(font.family)
  }))
}
export async function readFont(file: File) {
  if (!file.name.toLowerCase().endsWith('.woff2') || file.size > 2_000_000) throw Error('Use uma fonte WOFF2 de até 2 MB com licença para seu projeto.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (String.fromCharCode(...bytes.slice(0,4)) !== 'wOF2') throw Error('Arquivo WOFF2 inválido.')
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.buffer))].map(n => n.toString(16).padStart(2,'0')).join('')
  const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(`data:font/woff2;base64,${String(reader.result).split(',')[1]}`); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })
  return { family: `Marca-${hash.slice(0,12)}`, source, name: file.name.slice(0,100) }
}
export function fontChoices(brand: Brand) { return [...['Inter', 'Arial', 'Arial Black', 'Georgia', 'Verdana', 'Courier New'].map(family => ({ family, name: family })), ...brand.fonts] }
