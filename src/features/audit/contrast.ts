export type Color = [number,number,number,number]
export function parseColor(value: unknown): Color | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return [1,3,5].map(i => parseInt(raw.slice(i,i+2),16)).concat(1) as Color
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(0?\.\d+|1))?\s*\)$/i.exec(raw)
  return rgba ? [Number(rgba[1]),Number(rgba[2]),Number(rgba[3]),rgba[4] ? Number(rgba[4]) : 1] : null
}
export function composite(top: Color, bottom: Color): Color { const a = top[3]; return [0,1,2].map(i => Math.round(top[i]*a+bottom[i]*(1-a))).concat(1) as Color }
export function contrast(a: Color,b: Color) {
  const l = (c: Color) => [0,1,2].map(i => { const v=c[i]/255; return v<=.04045?v/12.92:((v+.055)/1.055)**2.4 }).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
  const x=l(a), y=l(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)
}
