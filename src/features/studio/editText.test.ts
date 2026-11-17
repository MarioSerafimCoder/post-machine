import { Textbox } from 'fabric'
import { expect, it } from 'vitest'
import { replaceTextboxText } from './editText'

const color = '#d60016'
const marks = (box: Textbox) => box.graphemeSplit(box.text).map((char,i) => box.getSelectionStyles(i,i+1)[0]?.fill === color ? char : '').join('')

it('mantém destaques ao inserir ou excluir quebras e grafemas Unicode', () => {
  const head = '💡 Cafe\u0301 '
  const box = new Textbox(head + 'ação 👩‍🎨\nFim')
  box.setSelectionStyles({fill:color},box.graphemeSplit(head).length,box.graphemeSplit(head+'ação 👩‍🎨').length)
  replaceTextboxText(box,'Novo\n'+box.text,{start:0,end:0})
  expect(marks(box)).toBe('ação 👩‍🎨')
  replaceTextboxText(box,box.text.replace('ação ',''))
  expect(marks(box)).toBe('👩‍🎨')
  const restored = box.toObject()
  expect(restored.styles).toHaveLength(1)
})
it('desloca a palavra destacada com uma inserção idêntica e mantém a nova palavra sem cor', () => {
  const box = new Textbox('cor cor')
  box.setSelectionStyles({fill:color},0,3)
  replaceTextboxText(box,'cor cor cor',{start:0,end:0})
  expect(box.getSelectionStyles(0,3).every(style => !style.fill)).toBe(true)
  expect(box.getSelectionStyles(4,7).every(style => style.fill===color)).toBe(true)
  replaceTextboxText(box,'cor cor',{start:4,end:8})
  expect(marks(box)).toBe('')
})
