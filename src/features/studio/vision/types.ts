import type { VisualAnalysis } from './signals'

export type VisionPhoto = { id: string; file: Blob }
export type VisionMessage = { type: 'result'; id: string; analysis: VisualAnalysis }
  | { type: 'photo-error'; id: string }
  | { type: 'complete' }
  | { type: 'error'; message: string }
