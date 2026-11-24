import type { Project } from '../studio/model'
import { exportFingerprint } from '../studio/delivery'
import type { AuditReport } from './contract'
import { z } from 'zod'

const reportSchema = z.object({
  projectId: z.uuid(), projectName: z.string(), documentVersion: z.literal(1),
  projectUpdatedAt: z.iso.datetime(), analyzedAt: z.iso.datetime(), totalSlides: z.number().int().min(1).max(20),
  rules: z.array(z.string()), unverifiable: z.array(z.string()), corrections: z.array(z.string()),
  status: z.enum(['clear', 'review', 'errors']),
  findings: z.array(z.object({
    id: z.string(), ruleId: z.string(), severity: z.enum(['error', 'warning', 'info']),
    category: z.enum(['geometry', 'typography', 'image', 'contrast', 'branding', 'consistency']),
    slideId: z.uuid(), slideNumber: z.number().int().min(1).max(20), objectId: z.string().nullable(),
    message: z.string(), details: z.string(), suggestion: z.string(), autoFixAvailable: z.boolean(),
    confidence: z.enum(['measured', 'estimated', 'unverifiable']),
  })),
})

const key = (id: string) => `post-machine:review:${id}`
async function signature(project: Project) {
  return exportFingerprint({ ...project, caption: JSON.stringify([project.brand, project.auditSettings]), name: '' })
}
export async function rememberReview(project: Project, report: AuditReport) {
  const fingerprint = await signature(project)
  try { localStorage.setItem(key(project.id), JSON.stringify({ version: 1, fingerprint, report })) } catch { /* Review is still usable in memory. */ }
}
export async function recallReview(project: Project): Promise<AuditReport | undefined> {
  try {
    const saved = JSON.parse(localStorage.getItem(key(project.id)) ?? 'null')
    if (saved?.version !== 1 || saved.fingerprint !== await signature(project)) return
    const parsed = reportSchema.safeParse(saved.report)
    if (parsed.success && parsed.data.projectId === project.id && parsed.data.totalSlides === project.slides.length &&
        parsed.data.findings.every(finding => project.slides[finding.slideNumber - 1]?.id === finding.slideId)) {
      return { ...parsed.data, projectName: project.name, projectUpdatedAt: project.updatedAt }
    }
  } catch { /* A missing or damaged cache must trigger a fresh review. */ }
}
