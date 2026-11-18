export type IconName = 'home' | 'radar' | 'studio' | 'audit' | 'arrow' | 'external' | 'book' | 'close' | 'shield' | 'news' | 'spark' | 'star' | 'text' | 'image' | 'shape' | 'layers' | 'folder' | 'clock' | 'trend'
const paths: Record<IconName, string> = {
  news: 'M4 3h16v18H4zM8 8h8M8 12h8M8 16h5',
  spark: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  star: 'm12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z',
  text: 'M4 5h16M12 5v14M8 19h8',
  image: 'M3 3h18v18H3zM3 17l5-5 4 4 4-6 5 7M8 8h.01',
  shape: 'M3 3h9v9H3zM16 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  folder: 'M3 5h7l2 3h9v12H3Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
  trend: 'm3 17 6-6 4 4 7-8m-5 0h5v5',
  home: 'm3 10 9-7 9 7v10H3zm6 10v-7h6v7',
  radar: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l8-8M12 12h.01',
  studio: 'M3 3h18v18H3zM3 8h18M8 8v13M12 12h5v5h-5z',
  audit: 'M9 4H5v17h14V4h-4M9 2h6v5H9zm0 12 2 2 4-4',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  book: 'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zm9 2v16',
  close: 'm6 6 12 12M6 18 18 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zm-4 9 3 3 5-6',
}
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true"><path d={paths[name]} /></svg>
}
