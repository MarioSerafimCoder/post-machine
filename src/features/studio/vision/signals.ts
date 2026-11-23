export type FocalPoint = { x: number; y: number }
export type VisualCue = { label: string; terms: string[] }
export type VisualAnalysis = { cue?: VisualCue; focalPoint?: FocalPoint }

const categories: [string, string[], number[]][] = [
  ['gato', ['gato', 'gatos', 'felino', 'felinos', 'cat', 'cats'], [281, 282, 283, 284, 285]],
  ['cão', ['cao', 'caes', 'cachorro', 'cachorros', 'canino', 'dog', 'dogs'], Array.from({ length: 118 }, (_, index) => 151 + index)],
  ['café ou xícara', ['cafe', 'cafes', 'espresso', 'xicara', 'xicaras', 'coffee', 'cups', 'mugs'], [504, 550, 967, 968]],
  ['bicicleta', ['bicicleta', 'bicicletas', 'ciclismo', 'bicycle', 'bikes'], [444, 671]],
  ['computador portátil', ['notebook', 'notebooks', 'laptop', 'computador', 'computadores'], [620, 681]],
  ['livros', ['livro', 'livros', 'livraria', 'biblioteca', 'quadrinhos', 'books', 'bookstore', 'library'], [454, 624, 917]],
  ['relógio', ['relogio', 'relogios', 'clock', 'clocks'], [409, 530, 892]],
  ['igreja, palácio ou castelo', ['igreja', 'palacio', 'castelo', 'church', 'palace', 'castle'], [483, 497, 698]],
  ['ponte ou viaduto', ['ponte', 'pontes', 'viaduto', 'bridge', 'bridges'], [821, 839, 888]],
  ['pizza', ['pizza', 'pizzas'], [963]],
  ['litoral', ['litoral', 'praia', 'praias', 'seashore', 'beach'], [978]],
]

export function cueFromScores(scores: Float32Array): VisualCue | undefined {
  if (scores.length !== 1000) return
  const best = scores.reduce((index, score, candidate) => score > scores[index] ? candidate : index, 0)
  const category = categories.find(([, , classes]) => classes.includes(best))
  if (!category) return
  const sum = scores.reduce((total, value) => total + Math.exp(value - scores[best]), 0)
  const confidence = category[2].reduce((total, index) => total + Math.exp(scores[index] - scores[best]) / sum, 0)
  if (confidence >= .50) return { label: category[0], terms: category[1] }
}

// Contrast concentration can place a crop; it does not identify the objects causing the contrast.
export function contrastFocalPoint(pixels: Uint8ClampedArray, width: number, height: number): FocalPoint | undefined {
  if (width < 12 || height < 12 || pixels.length !== width * height * 4) return
  const luminance = (at: number) => (pixels[at] * .2126 + pixels[at + 1] * .7152 + pixels[at + 2] * .0722) * pixels[at + 3] / 255
  const windows = Array.from({ length: 16 }, () => ({ score: 0, x: 0, y: 0 }))
  let total = 0
  for (let row = 2; row < height - 2; row++) for (let column = 2; column < width - 2; column++) {
    const at = (row * width + column) * 4
    const contrast = Math.abs(luminance(at - 4) - luminance(at + 4)) + Math.abs(luminance(at - width * 4) - luminance(at + width * 4))
    const weight = Math.max(0, contrast - 30)
    const x = column / width, y = row / height
    const window = windows[Math.floor(y * 4) * 4 + Math.floor(x * 4)]
    window.score += weight; window.x += x * weight; window.y += y * weight; total += weight
  }
  const strongest = windows.reduce((best, cell) => cell.score > best.score ? cell : best)
  if (total < 1200 || strongest.score / total < .38) return
  const x = strongest.x / strongest.score, y = strongest.y / strongest.score
  if (Math.hypot(x - .5, y - .5) >= .12) return { x, y }
}
