import { emptySlide, newProject, type Project, type Scene } from './model'

const ink = '#111110'
const paper = '#F5F4F0'
const navy = '#10162F'
const orange = '#FA511B'
const cream = '#FFF8BD'
const x = .75
const y = 1350 / 1920

function text(value: string, left: number, top: number, width: number, size: number,
  fill = ink, role = 'fixed', extra: Record<string, unknown> = {}) {
  return { type: 'Textbox', originX: 'left', originY: 'top', strokeWidth: 0,
    left: left * x, top: top * y, width: width * x, text: value, fontFamily: 'Inter',
    fontSize: size * x, fill, fontWeight: 400, charSpacing: -50, lineHeight: 1.06,
    templateRole: role, semantic: role, ...extra }
}

function rect(left: number, top: number, width: number, height: number, fill: string,
  extra: Record<string, unknown> = {}) {
  return { type: 'Rect', originX: 'left', originY: 'top', strokeWidth: 0,
    left: left * x, top: top * y, width: width * x, height: height * y,
    fill, templateRole: 'decoration', ...extra }
}

function photo(left: number, top: number, width: number, height: number, radius = 0) {
  return rect(left, top, width, height, '#5C6260', { rx: radius * x, ry: radius * x,
    semantic: 'imageFrame', templateRole: 'image', label: 'Fotografia substituível' })
}

function gradient(left: number, top: number, width: number, height: number, radius = 0) {
  return rect(left, top, width, height, ink, { rx: radius * x, ry: radius * x,
    semantic: 'editorialGradient', fill: { type: 'linear', gradientUnits: 'pixels',
      coords: { x1: 0, y1: 0, x2: 0, y2: height * y }, colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0.22)' }, { offset: .38, color: 'rgba(0,0,0,0)' },
        { offset: .65, color: 'rgba(0,0,0,0.38)' }, { offset: 1, color: 'rgba(0,0,0,0.9)' },
      ] } })
}

function header(fill = ink) {
  return [text('Caderno de conteúdo', 58, 42, 500, 23, fill),
    text('@seuestudio', 728, 42, 310, 23, fill, 'signature'),
    text('2026 //', 1200, 42, 182, 23, fill, 'fixed', { textAlign: 'right' })]
}

function heading(value: string, top = 150) {
  return [text(value, 85, top, 1270, 65, ink, 'title', { textAlign: 'center', maxHeight: 145 }),
    rect(640, top + (value.includes('\n') ? 180 : 108), 160, 4, orange)]
}

function footer(value: string) {
  return [rect(85, 1715, 1270, 1.5, '#CECECA'),
    text(value, 100, 1760, 1240, 39, orange, 'cta', { textAlign: 'center', maxHeight: 95 })]
}

/** Original geometric icons, built with the editor's supported primitives. */
function icon(kind: number, left: number, top: number, color = orange) {
  const line = (a: number, b: number, c: number, d: number) => ({ type: 'Line',
    originX: 'left', originY: 'top', left: (left + Math.min(a, c)) * x, top: (top + Math.min(b, d)) * y,
    x1: a * x, y1: b * y, x2: c * x, y2: d * y,
    stroke: color, strokeWidth: 3 * x, fill: color, templateRole: 'decoration' })
  const circle = (a: number, b: number, radius: number) => ({ type: 'Circle', originX: 'left', originY: 'top',
    left: (left + a) * x, top: (top + b) * y, radius: radius * x,
    fill: 'transparent', stroke: color, strokeWidth: 3 * x, templateRole: 'decoration' })
  if (kind === 0) return [line(5, 45, 5, 0), line(5, 0, 36, 0), line(36, 0, 29, 11), line(29, 11, 36, 22), line(36, 22, 5, 22)]
  if (kind === 1) return [circle(1, 10, 19), line(14, 0, 26, 0), line(21, 20, 21, 31), line(21, 31, 29, 36)]
  if (kind === 2) return [line(0, 10, 11, 0), line(11, 0, 20, 5), line(20, 5, 29, 0), line(29, 0, 40, 10),
    line(40, 10, 32, 18), line(32, 18, 32, 44), line(32, 44, 8, 44), line(8, 44, 8, 18), line(8, 18, 0, 10)]
  if (kind === 3) return [circle(8, 21, 13), line(8, 0, 16, 23), line(16, 23, 24, 0), line(24, 0, 36, 0), line(36, 0, 27, 24), line(8, 0, 19, 0)]
  return [line(0, 23, 40, 23), line(25, 8, 40, 23), line(40, 23, 25, 38)]
}

export function createEditorial03(): Project {
  const design = newProject('portrait')
  design.name = 'Editorial 03 · Jornada'
  design.brand = { ...design.brand, margin: 44, primary: navy, secondary: orange, background: paper }
  const steps = [
    ['O próximo destino', 'Apresente o objetivo que coloca a história em movimento.'],
    ['A contagem', 'Situe cada publicação no tempo de preparação.'],
    ['A escolha', 'Mostre os detalhes e as decisões que fazem parte do caminho.'],
    ['A chegada', 'Conte o que aconteceu e o que ficou de aprendizado.'],
    ['O próximo começo', 'Deixe uma abertura para o capítulo que vem a seguir.'],
  ]
  const scenes: Scene[] = [
    { background: '#FFFFFF', objects: [
      photo(30, 40, 1380, 1840, 32), gradient(30, 40, 1380, 1840, 32),
      text('Histórias em movimento', 72, 104, 750, 50, cream, 'fixed'),
      rect(72, 171, 210, 49, cream, { rx: 25 * x, ry: 25 * x }),
      text('Série editorial', 86, 181, 184, 24, ink, 'fixed', { fontWeight: 600, textAlign: 'center' }),
      text('Um olhar sobre as pessoas, as escolhas e os caminhos que merecem ser acompanhados.',
        920, 108, 450, 28, '#FFFFFF', 'body', { textAlign: 'right', maxHeight: 110 }),
      text('Uma rotina que inspira:', 72, 1280, 1270, 59, cream, 'subtitle', { maxHeight: 70 }),
      text('como transformar os\nbastidores de uma jornada\nem uma história que vale\na pena acompanhar?',
        72, 1365, 1270, 88, '#FFFFFF', 'title', { maxHeight: 330, lineHeight: 1.01 }),
      text('T1 · episódio 01 @seuestudio', 72, 1798, 780, 26, '#FFFFFF', 'signature', { fontWeight: 600 }),
      text('Caderno de conteúdo', 1000, 1798, 370, 26, '#FFFFFF', 'fixed', { textAlign: 'right', fontWeight: 600 }),
    ] },
    { background: '#FFFFFF', objects: [
      photo(0, 0, 1440, 1380), ...header('#FFFFFF'),
      text('Toda jornada começa com uma pessoa, um contexto e um objetivo. Apresente quem está no centro da história e o que ela quer construir.',
        85, 1450, 1270, 56, ink, 'title', { maxHeight: 180 }),
      text('A introdução dá ao leitor as informações necessárias para acompanhar os próximos capítulos.',
        85, 1715, 1270, 38, '#707070', 'body', { maxHeight: 100 }),
    ] },
    { background: navy, objects: [
      ...header('#FFFFFF'),
      text('Um projeto pode ser contado como uma jornada que o público acompanha. As imagens aproximam dois momentos: a preparação e aquilo que acontece pelo caminho.',
        85, 160, 1270, 55, '#FFFFFF', 'title', { textAlign: 'center', maxHeight: 245 }),
      photo(85, 545, 619, 1095, 30), photo(736, 545, 619, 1095, 30),
      text('Cada escolha, tentativa e descoberta acrescenta uma nova camada à história que estamos acompanhando.',
        150, 1710, 1140, 39, '#BCBECA', 'body', { textAlign: 'center', maxHeight: 110 }),
    ] },
    { background: paper, objects: [
      ...header(), ...heading('Duas formas de contar uma jornada'),
      text('O resultado orienta o relato', 280, 400, 540, 31, ink, 'fixed', { fontWeight: 600, textAlign: 'center' }),
      text('A experiência orienta o relato', 842, 400, 540, 31, ink, 'fixed', { fontWeight: 600, textAlign: 'center' }),
      text('Durante a\npreparação', 58, 675, 208, 31, ink, 'fixed', { fontWeight: 600 }),
      text('Perto da\nchegada', 58, 1248, 208, 31, ink, 'fixed', { fontWeight: 600 }),
      ...[
        [280, 465, 'Compare o desempenho entre duas etapas do mesmo percurso.'],
        [842, 465, 'Mostre como a preparação se encaixa no cotidiano.'],
        [280, 1017, 'Apresente o que falta para alcançar o objetivo.'],
        [842, 1017, 'Conte como foi a última tentativa e quais escolhas vieram depois.'],
      ].flatMap(([left, top, value], index) => {
        const selected = index === 3
        const l = Number(left); const t = Number(top)
        return [rect(l, t, 540, 530, selected ? orange : '#FFFFFF',
          { rx: 30 * x, ry: 30 * x, stroke: selected ? orange : '#DDDDD8', strokeWidth: 1 }),
        ...icon(index, l + 48, t + 45, selected ? '#FFFFFF' : orange),
        text(String(value), l + 40, t + 120, 460, 39, selected ? '#FFFFFF' : '#333333', 'body', { maxHeight: 245 })]
      }),
      ...footer('O destino marca uma data. A história acontece no caminho.'),
    ] },
    { background: ink, objects: [
      photo(0, 0, 1440, 1920), gradient(0, 0, 1440, 1920), ...header('#FFFFFF'),
      text('Uma jornada também tem desvios. Mostrar o que não saiu como o esperado abre espaço para falar de limites, escolhas e aprendizado.',
        85, 1390, 1270, 54, cream, 'title', { maxHeight: 220 }),
      text('O capítulo seguinte pode retomar essa dificuldade e mostrar o que mudou durante a preparação.',
        85, 1710, 1270, 38, '#FFFFFF', 'body', { maxHeight: 115 }),
    ] },
    { background: '#FFFFFF', objects: [
      ...header(), photo(795, 158, 587, 1650, 36),
      text('Os detalhes também contam a história. Uma escolha de roupa, um objeto ou um gesto pode revelar como a pessoa vive esse momento.',
        85, 655, 625, 55, ink, 'title', { maxHeight: 310 }),
      text('Aproxime o olhar do cotidiano. É nele que o leitor encontra os detalhes que tornam cada jornada particular.',
        85, 1110, 625, 39, '#707070', 'body', { maxHeight: 180 }),
    ] },
    { background: paper, objects: [
      ...header(), ...heading('Como acompanhar o ciclo\nde uma história no perfil'),
      ...steps.flatMap(([title, body], index) => {
        const top = 400 + index * 252
        return [rect(59, top, 1322, 203, '#FFFFFF', { rx: 26 * x, ry: 26 * x, stroke: '#DDDDD8', strokeWidth: 1 }),
          text(`0${index + 1}.`, 100, top + 77, 120, 51, orange, 'fixed', { fontWeight: 600 }),
          ...icon(index, 238, top + 80, ink),
          text(title, 324, top + 56, 1005, 39, ink, 'fixed', { fontWeight: 600 }),
          text(body, 324, top + 114, 1005, 32, '#666666', 'body', { maxHeight: 70 }),
          ...(index < 4 ? [text('↓', 126, top + 210, 50, 39, orange, 'decoration')] : [])]
      }),
      ...footer('Cada chegada pode abrir espaço para um próximo começo.'),
    ] },
  ]
  design.slides = scenes.map((scene, index) => ({ ...emptySlide(), scene, layout: 'editorial',
    role: index === 0 ? 'cover' : index === scenes.length - 1 ? 'cta' : 'content' }))
  return design
}
