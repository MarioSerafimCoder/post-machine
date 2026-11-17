import type { Textbox } from 'fabric'

type Range = { start: number; end: number }

// Fabric styles use grapheme positions within the original lines, never UTF-16 offsets.
export function replaceTextboxText(box: Textbox, value: string, selection?: Range) {
  const nextValue = value.replace(/\r\n?/g,'\n')
  if (nextValue === box.text) return
  if (Object.keys(box.styles).length === 0) {
    box.set({text:nextValue})
    box.setCoords()
    return
  }
  const previous = box.graphemeSplit(box.text)
  const next = box.graphemeSplit(nextValue)
  const same = (first: string[], second: string[]) => first.length === second.length && first.every((item,index) => item === second[index])
  let prefix = 0, suffix = 0
  let anchored = false
  // The actual old selection breaks ties when identical words occur next to one another.
  if (selection && selection.start <= selection.end) {
    const left = box.graphemeSplit(box.text.slice(0,selection.start))
    const right = box.graphemeSplit(box.text.slice(selection.end))
    if (left.length+right.length <= Math.min(previous.length,next.length) &&
        same(left,previous.slice(0,left.length)) && same(right,previous.slice(previous.length-right.length)) &&
        same(left,next.slice(0,left.length)) && same(right,next.slice(next.length-right.length))) {
      prefix=left.length
      suffix=right.length
      anchored=true
    }
  }
  if (!anchored) {
    while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++
    while (prefix + suffix < previous.length && prefix + suffix < next.length &&
        previous[previous.length-suffix-1] === next[next.length-suffix-1]) suffix++
  }
  let line = 0, column = 0
  const oldStyles = previous.map(char => {
    const style = char === '\n' ? undefined : box.styles[line]?.[column]
    if (char === '\n') { line++; column=0 } else column++
    return style
  })
  const styles: Textbox['styles'] = {}
  line = 0; column = 0
  for (const [index,char] of next.entries()) {
    if (char === '\n') { line++; column=0; continue }
    const oldIndex = index < prefix ? index : index >= next.length-suffix ? index-next.length+previous.length : -1
    const style = oldStyles[oldIndex]
    if (style) (styles[line] ??= {})[column] = { ...style }
    column++
  }
  box.set({text:nextValue,styles})
  box.setCoords()
}
