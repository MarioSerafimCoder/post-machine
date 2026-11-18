import type { AuditReport, Finding } from '../audit/contract'
import { sameReviewVersion } from '../audit/review'
import type { Project } from '../studio/model'
import { useAssistantSignal } from './signals'

const ruleByAudit: Record<string, string> = {
  LOW_CONTRAST: 'VIS-002', CONTRAST_UNKNOWN: 'VIS-002', TEXT_OVERFLOW: 'VIS-003',
  OUTSIDE_CANVAS: 'EXP-001', SAFE_MARGIN: 'EXP-001', IMAGE_LICENSE_UNKNOWN: 'ETH-002',
  IMAGE_CREDIT_INCOMPLETE: 'ETH-002',
}

export function useAuditAssistant({ area, project, source, report, current, locate, fix, canFix }: {
  area?: 'studio' | 'auditoria'
  project?: Project; source?: Project; report?: AuditReport; current?: number
  locate: (finding: Finding) => void; fix?: (finding: Finding) => void; canFix?: (finding: Finding) => boolean
}) {
  const valid = area && project && source && report && sameReviewVersion(source, project)
  const issues = valid ? report.findings.filter(item => item.severity !== 'info' || item.confidence === 'unverifiable') : []
  const priority = (item: Finding) => (item.slideId === project?.slides[current ?? -1]?.id ? 3 : 0) + (item.severity === 'error' ? 2 : 0)
  const issue = issues.reduce<Finding | undefined>((best, item) => !best || priority(item) > priority(best) ? item : best, undefined)
  useAssistantSignal(area && project && issue ? {
    area, scope: project.id, priority: 80, category: 'audit', subject: issue.slideId,
    severity: issue.severity === 'error' ? 'blocking' : 'warning',
    insight: {
      id: `audit:${issue.id}`, ruleId: ruleByAudit[issue.ruleId] ?? 'OPS-001',
      title: `Slide ${issue.slideNumber} · ${issue.message}`,
      detail: `${issue.details} ${issue.suggestion} ${issues.length} ocorrência(s) de revisão no relatório atual.`,
      assessment: issue.confidence === 'measured' ? 'verified' : 'needs_review',
      actions: [
        { label: 'Localizar ocorrência', run: () => locate(issue) },
        ...(fix && issue.autoFixAvailable && canFix?.(issue) ? [{ label: 'Propor correção existente', run: () => fix(issue) }] : []),
      ],
    },
  } : undefined)
}
