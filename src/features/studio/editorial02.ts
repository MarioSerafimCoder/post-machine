import { emptySlide, newProject, type Project, type Scene } from './model'

const ink = '#0D0D19'
const paper = '#F5F4F1'
const orange = '#FF591D'

function text(value: string, left: number, top: number, width: number, fontSize: number,
  fill = paper, role = 'fixed', extra: Record<string, unknown> = {}) {
  return { type: 'Textbox', originX: 'left', originY: 'top', strokeWidth: 0,
    left, top, width, text: value, fontFamily: 'Inter', fontSize, fill,
    fontWeight: 400, charSpacing: -45, lineHeight: 1.08,
    templateRole: role, semantic: role, ...extra }
}

function rect(left: number, top: number, width: number, height: number, fill: string,
  extra: Record<string, unknown> = {}) {
  return { type: 'Rect', originX: 'left', originY: 'top', strokeWidth: 0,
    left, top, width, height, fill, templateRole: 'decoration', ...extra }
}

const photo = (top: number, height: number, full = false) => rect(full ? 0 : 64, top,
  full ? 1080 : 952, height, '#46464C', { templateRole: 'image', semantic: 'imageFrame', label: 'Fotografia substituível' })

function header(fill = paper, full = false) {
  return [text('Caderno de conteúdo', full ? 44 : 64, 30, 430, 17, fill),
    text('@seuestudio', 546, 30, 265, 17, fill, 'signature'),
    text('2026 //', 886, 30, full ? 150 : 130, 17, fill, 'fixed', { textAlign: 'right' })]
}

function highlight(value: string, phrase: string, fill = orange) {
  const start = value.indexOf(phrase)
  return [{ start, end: start + phrase.length, style: { fill } }]
}

/** Five editable compositions; reference uploads are never bundled with the app. */
export function createEditorial02(): Project {
  const design = newProject('portrait')
  design.name = 'Editorial 02 · Laranja'
  design.brand = { ...design.brand, margin: 64, primary: ink, secondary: orange, background: paper }
  const lead = 'O conteúdo ganha força quando encontra uma conversa. Uma boa imagem abre o caminho: o texto dá um motivo para continuar.'
  const lightLead = 'Uma pessoa pode descobrir seu trabalho por uma imagem. A relação se constrói quando existe um motivo para voltar.'
  const lightBody = 'Na próxima publicação, escolha uma ideia que mereça ser lembrada: uma conversa pode continuar depois do primeiro contato.'
  const rows = [
    ['Observe o que acontece depois do post. Vá além da primeira impressão e procure sinais de uma conversa que continua.', 'sinais de uma conversa'],
    ['Abra espaço para uma pergunta concreta sobre o seu trabalho e reserve tempo para acompanhar as respostas.', 'uma pergunta concreta'],
    ['Compare as publicações pelo que elas ajudam a construir: contexto, confiança e vontade de voltar à conversa.', 'contexto, confiança e vontade de voltar à conversa.'],
  ]
  const scenes: Scene[] = [
    { background: ink, objects: [
      photo(0, 1350, true),
      rect(0, 0, 1080, 1350, ink, { semantic: 'editorialGradient', fill: {
        type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: 0, y2: 1350 },
        colorStops: [{ offset: 0, color: 'rgba(0,0,0,0.16)' }, { offset: .48, color: 'rgba(0,0,0,0)' },
          { offset: .75, color: 'rgba(0,0,0,0.68)' }, { offset: 1, color: 'rgba(0,0,0,0.96)' }],
      } }),
      ...header(paper, true),
      { type: 'Circle', originX: 'left', originY: 'top', strokeWidth: 0, left: 384, top: 930, radius: 25, fill: orange, templateRole: 'decoration' },
      text('✳', 388, 934, 42, 34, ink, 'decoration', { textAlign: 'center' }),
      text('@seuestudio', 449, 941, 265, 26, paper, 'signature'),
      text('Uma audiência menor\nque acredita em você', 64, 1010, 952, 65, paper, 'title',
        { fontWeight: 600, textAlign: 'center', lineHeight: 1.02, maxHeight: 165 }),
      text('vale mais do que qualquer\nmomento viral.', 50, 1159, 980, 65, '#FF4D00', 'subtitle',
        { fontWeight: 600, textAlign: 'center', lineHeight: 1.02, maxHeight: 165 }),
    ] },
    { background: ink, objects: [
      ...header(), photo(84, 696),
      text(lead, 64, 829, 952, 37, paper, 'title', { fontWeight: 600, maxHeight: 215,
        styles: highlight(lead, 'o texto dá um motivo para continuar.') }),
      text('Uma imagem chama a atenção. A sequência organiza o raciocínio e deixa espaço para quem está do outro lado responder.',
        64, 1050, 952, 33, '#BDBDC3', 'body', { maxHeight: 175 }),
    ] },
    { background: orange, objects: [
      ...header(ink),
      text('Uma comparação visual ajuda a explicar uma mudança. Apresente o contexto antes de mostrar o resultado.',
        64, 110, 952, 42, ink, 'title', { fontWeight: 600, maxHeight: 160 }),
      text('antes', 154, 300, 358, 61, ink, 'fixed', { fontWeight: 700 }),
      rect(154, 370, 358, 570, ink, { rx: 10, ry: 10 }),
      text('depois', 568, 633, 358, 61, ink, 'fixed', { fontWeight: 700 }),
      rect(568, 704, 358, 236, paper, { rx: 10, ry: 10 }),
      text('Cenário inicial', 154, 958, 358, 27, ink, 'fixed', { fontWeight: 700 }),
      text('Cenário seguinte', 568, 958, 358, 27, ink, 'fixed', { fontWeight: 700 }),
      rect(64, 1036, 952, 3, ink),
      text('Diagrama ilustrativo, sem escala. Fonte: insira os dados verificados.', 64, 1055, 952, 19, ink),
      text('Use este quadro para comparar dois momentos. Antes de publicar, substitua os rótulos, ajuste as barras e informe a fonte e o período dos dados.',
        64, 1124, 952, 35, ink, 'body', { maxHeight: 170 }),
    ] },
    { background: paper, objects: [
      ...header(ink), photo(84, 817),
      text(lightLead, 64, 950, 952, 39, ink, 'title', { fontWeight: 600, maxHeight: 170 }),
      text(lightBody, 64, 1130, 952, 34, '#464649', 'body', { maxHeight: 165,
        styles: highlight(lightBody, 'uma conversa pode continuar depois do primeiro contato.', '#DE582D') }),
    ] },
    { background: ink, objects: [
      ...header(), photo(90, 551),
      ...rows.flatMap(([value, phrase], index) => {
        const y = 680 + index * 204
        return [rect(64, y, 952, 1.5, '#36363F'),
          text('→', 64, y + 45, 48, 31, orange, 'decoration'),
          text(value, 134, y + 39, 882, 36, paper, index === 0 ? 'title' : 'body',
            { maxHeight: 160, styles: highlight(value, phrase) })]
      }),
      rect(64, 1292, 952, 1.5, '#36363F'),
    ] },
  ]
  design.slides = scenes.map((scene, index) => ({ ...emptySlide(), scene, layout: 'editorial',
    role: index === 0 ? 'cover' : index === 4 ? 'cta' : 'content' }))
  return design
}
