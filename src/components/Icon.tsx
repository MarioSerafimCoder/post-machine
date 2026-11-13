export type IconName = 'home' | 'radar' | 'studio' | 'audit' | 'arrow' | 'external' | 'book' | 'close' | 'shield'
const paths: Record<IconName, string> = {
  home: 'm3 10 9-7 9 7v10H3zm6 10v-7h6v7',
  radar: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l8-8M12 12h.01',
  studio: 'M3 3h18v18H3zM3 9h18M9 9v12',
  audit: 'M9 4H5v17h14V4h-4M9 2h6v5H9zm0 12 2 2 4-4',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  book: 'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zm9 2v16',
  close: 'm6 6 12 12M6 18 18 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zm-4 9 3 3 5-6',
}
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={className} width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
