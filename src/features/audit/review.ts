import type { Project } from '../studio/model'
import type { AuditReport } from './contract'

export type Review = { project: Project; report: AuditReport }
export function sameReviewSettings(a: Project, b: Project) {
  return a.id === b.id && a.format === b.format && a.brand === b.brand && a.auditSettings === b.auditSettings
}
export function sameReviewVersion(a: Project, b: Project) {
  return sameReviewSettings(a,b) && a.slides === b.slides
}
