import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Canvas } from 'fabric'
import { analyzeHeadline } from '../headlines/analysis'
import { inspectCanvas } from '../audit/rules'
import type { Finding } from '../audit/contract'
import { useAssistantSignal, type Signal } from '../intelligence/signals'
import { dimensions, type Project } from './model'

export function useEditingReview(active: boolean, canvas: Canvas | null, project: Project | undefined, index: number,
  locate: (finding: Finding) => void, analyze: () => void) {
  const slide = project?.slides[index]
  const brand = project?.brand
  const settings = project?.auditSettings
  const scope = project?.id
  const format = project?.format
  const actions = useRef({ locate, analyze })
  useLayoutEffect(() => { actions.current = { locate, analyze } }, [locate, analyze])
  const [review, setReview] = useState<{ slide: NonNullable<typeof slide>; canvas: Canvas; index: number; brand: NonNullable<typeof brand>; settings: typeof settings; format: typeof format; signal?: Signal }>()
  useEffect(() => {
    if (!active || !canvas || !slide || !brand || !scope || !format) return
    const timer = window.setTimeout(() => {
      const findings = inspectCanvas(canvas, slide.id, index + 1, brand, slide.layout, slide.role, settings, dimensions[format])
      const finding = findings.find(item => item.ruleId === 'TEXT_OVERFLOW') ??
        findings.find(item => item.severity === 'error') ?? findings.find(item => item.ruleId === 'EMPTY_TEXT' || item.ruleId === 'REQUIRED_FIELD')
      const title = slide.scene.objects.find(object => object.semantic === 'title' && object.visible !== false)?.text
      const generic = !finding && typeof title === 'string' && analyzeHeadline(title, { maxChars: 0, maxWords: 0 },
        { format: '', sources: [], slides: [] }).heuristic.find(item => item.includes('termos genéricos'))
      const issue = finding ?? (!generic ? findings[0] : undefined)
      const signal: Signal | undefined = issue ? {
        scope, area: 'studio', category: 'editing', priority: 55, subject: slide.id,
        severity: issue.severity === 'error' ? 'blocking' : 'warning',
        insight: { id: `auto:${issue.id}`, ruleId: issue.ruleId === 'TEXT_OVERFLOW' ? 'VIS-003' : 'OPS-001',
          title: `Slide ${index + 1} · ${issue.message}`, detail: `${issue.details} ${issue.suggestion}`, assessment: 'verified',
          actions: [{ label: 'Localizar ocorrência', run: () => actions.current.locate(issue) }] },
      } : generic && typeof title === 'string' ? {
        scope, area: 'studio', category: 'editing', priority: 54, subject: slide.id,
        version: title.slice(0, 500),
        insight: { id: `edit:${slide.id}:generic-title`, ruleId: 'TTL-003', title: `Slide ${index + 1} · O título tem termos genéricos`,
          detail: generic, assessment: 'heuristic', actions: [{ label: 'Analisar título', run: () => actions.current.analyze() }] },
      } : undefined
      setReview({ slide, canvas, index, brand, settings, format, signal })
    }, 750)
    return () => window.clearTimeout(timer)
  }, [active, canvas, slide, brand, scope, index, settings, format])
  const signal = active && review && review.slide === slide && review.canvas === canvas &&
    review.index === index && review.brand === brand && review.settings === settings && review.format === format ? review.signal : undefined
  useAssistantSignal(signal)
}
