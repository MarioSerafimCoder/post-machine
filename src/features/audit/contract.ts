import type { Project } from '../studio/model'
export type Severity = 'error' | 'warning' | 'info'
export type Category = 'geometry' | 'typography' | 'image' | 'contrast' | 'branding' | 'consistency'
export type Finding = { id: string; ruleId: string; severity: Severity; category: Category; slideId: string; slideNumber: number; objectId: string | null; message: string; details: string; suggestion: string; autoFixAvailable: boolean; confidence: 'measured' | 'estimated' | 'unverifiable' }
export type AuditReport = { projectId: string; projectName: string; documentVersion: number; projectUpdatedAt: string; analyzedAt: string; totalSlides: number; rules: string[]; findings: Finding[]; unverifiable: string[]; corrections: string[]; status: 'clear' | 'review' | 'errors' }
export type AuditSettings = { requireBrand: boolean; requireLogo: boolean; enforcePalette: boolean; minBodySize: number; minLargeSize: number; contrastNormal: number; contrastLarge: number }
export const defaultSettings: AuditSettings = { requireBrand: false, requireLogo: false, enforcePalette: false, minBodySize: 24, minLargeSize: 36, contrastNormal: 4.5, contrastLarge: 3 }
export type AuditTarget = { project: Project; slideIndex?: number; settings?: AuditSettings; signal?: AbortSignal; progress?: (done: number, total: number) => void }
export const rules = ['OUTSIDE_CANVAS','SAFE_MARGIN','INVALID_SIZE','EXTREME_SCALE','TEXT_OVERFLOW','TEXT_INVISIBLE','FONT_UNAVAILABLE','SMALL_TEXT','TEXT_SPACING','OCCLUDED_TEXT','IMAGE_MISSING','IMAGE_RESOLUTION','IMAGE_CROP','UNVERIFIABLE_IMAGE','LOW_CONTRAST','CONTRAST_UNKNOWN','BRAND_MISSING','LOGO_MISSING','PALETTE','REQUIRED_FIELD','OVERLAP_REVIEW']
