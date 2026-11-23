import type { Textbox } from 'fabric'

export type TextMeasurement = {
  field: string; width: number; height: number; lines: number; size: number
  minimum: number; preferred: number; fits: boolean; inkWidth: number
}

export function fitText(item: Textbox, width: number, height: number, preferred: number, minimum: number): TextMeasurement {
  const fits = () => item.height <= height+1 && item.width <= width+1
  const reset = (size: number) => item.set({ fontSize:size, width })
  if (!fits()) {
    item.set({ lineHeight:1.04, charSpacing:-8, width })
    if (!fits()) {
      reset(minimum)
      if (item.width > width + 1) item.set({ splitByGrapheme: true, width })
      if (fits()) {
        let low = minimum
        let high = preferred
        // Binary search limits repeated measuring for very long copy.
        for (let pass = 0; high - low > 1 && pass < 8; pass++) {
          const middle = Math.floor((low+high)/2)
          reset(middle)
          if (fits()) low = middle
          else high = middle
        }
        reset(low)
      }
    }
  }
  return { field:item.semantic ?? '', width:item.width, height:item.height, lines:item.textLines.length,
    size:item.fontSize, minimum, preferred, fits:fits(),
    inkWidth:Math.max(0,...item.textLines.map((_,index) => item.getLineWidth(index))) }
}
