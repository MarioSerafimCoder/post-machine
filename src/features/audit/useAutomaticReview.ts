import { useEffect, useEffectEvent } from 'react'
import type { Project } from '../studio/model'
import { recallReview } from './reviewStorage'
import { auditProject } from './engine'
import { sameReviewVersion, type Review } from './review'
import type { AuditReport } from './contract'

export function useAutomaticReview(active: boolean, project: Project | undefined, review: Review | undefined,
  receive: (report: AuditReport, project: Project) => void) {
  const report = useEffectEvent(receive)
  useEffect(() => {
    if (!active || !project || (review && sameReviewVersion(review.project, project))) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void recallReview(project).then(cached => { controller.signal.throwIfAborted(); return cached ?? auditProject({ project, signal: controller.signal }) }).then(value => {
        if (!controller.signal.aborted) report(value, project)
      }).catch(() => { /* Explicit review retains detailed error reporting. */ })
    }, 1400)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [active, project, review])
}
