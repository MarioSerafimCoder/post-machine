import { fontChoices, loadFonts, readFont } from './fonts'
import type { Brand } from './model'
import { readImage } from './images'
export function BrandPanel({ brand, update, apply, error }: { brand: Brand; update: (brand: Brand) => void; apply: () => void; error: (message: string) => void }) {
  return <><h3>Minha marca</h3><label>Nome da marca<input value={brand.name} maxLength={100} onChange={e => update({ ...brand, name: e.target.value })} /></label><label>Identificador social<input value={brand.handle} maxLength={100} onChange={e => update({ ...brand, handle: e.target.value })} /></label>
    {(['primary', 'secondary', 'background'] as const).map((key, i) => <label key={key}>{['Cor principal', 'Cor secundária', 'Fundo'][i]}<input type="color" value={brand[key]} onChange={e => update({ ...brand, [key]: e.target.value })} /></label>)}
    {(['headingFont', 'bodyFont'] as const).map((key, i) => <label key={key}>{i === 0 ? 'Fonte dos títulos' : 'Fonte dos textos'}<select value={brand[key]} onChange={e => update({ ...brand, [key]: e.target.value })}>{fontChoices(brand).map(font => <option key={font.family} value={font.family}>{font.name}</option>)}</select></label>)}
    <label>Carregar fonte WOFF2<input type="file" accept=".woff2" disabled={brand.fonts.length >= 8} onChange={e => { const file = e.target.files?.[0]; if (file) void readFont(file).then(async font => { const next = { ...brand, fonts: [...brand.fonts.filter(f => f.family !== font.family), font], headingFont: font.family }; await loadFonts(next); update(next) }).catch(failure => error(String(failure))); e.target.value = '' }} /></label><p>Use fontes licenciadas para seu projeto. Arquivos ficam somente neste navegador e no backup.</p>
    <label>Margem segura (px)<input type="number" min={24} max={160} value={brand.margin} onChange={e => update({ ...brand, margin: Math.max(24, Math.min(160, Number(e.target.value))) })} /></label>
    <label>Logotipo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) void readImage(file).then(img => { const el = document.createElement('canvas'); el.width = 180; el.height = 180; const context = el.getContext('2d')!; const scale = Math.min(180 / img.width, 180 / img.height); context.drawImage(img.getElement(), 0, 0, img.width * scale, img.height * scale); update({ ...brand, logo: el.toDataURL() }); img.dispose() }, failure => error(String(failure))); e.target.value = '' }} /></label>
    {brand.logo && <button onClick={() => update({ ...brand, logo: null })}>Remover logotipo</button>}
    <button onClick={apply}>Aplicar marca a todos os slides</button><p>Recompõe os templates; confirme para substituir ajustes gráficos. Textos e imagens são preservados.</p>
  </>
}
