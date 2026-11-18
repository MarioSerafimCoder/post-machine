import { z } from 'zod'
import data from './catalog.json'

const ruleId = z.string().regex(/^[A-Z]+-\d{3}$/)
const sourceId = z.string().regex(/^F\d{2}$/)
const evidenceId = z.string().regex(/^EV-[A-Z0-9-]+$/)
const platformRule = z.object({
  key: z.string(), value: z.union([z.number(), z.string(), z.array(z.string())]),
  unit: z.string().optional(), source_id: sourceId.optional(), note: z.string().optional(), confidence: z.string().optional(),
})
const knowledgeSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  edition: z.iso.date(),
  rules: z.array(z.object({
    rule_id: ruleId, name: z.string().min(1), category: z.string(),
    level: z.enum(['blocking', 'recommended', 'experimental']),
    check_type: z.enum(['review_required', 'deterministic', 'editorial']),
    when: z.string(), action: z.string(), exceptions: z.array(z.string()),
    validation: z.string(), reason: z.string(), version: z.string(), updated_at: z.iso.date(),
    sourceIds: z.array(sourceId), evidenceIds: z.array(evidenceId),
  }).transform(item => ({ ...item, id: item.rule_id }))),
  sources: z.array(z.object({
    id: sourceId, title: z.string().min(1), url: z.union([z.url({ protocol: /^https$/ }), z.literal(''), z.null()]).optional(),
    origin: z.string(), verified_at: z.iso.date(),
    verification: z.enum(['reference_recovered_from_pdf', 'official_snippet_only', 'official_page_checked']),
  })),
  evidence: z.record(evidenceId, z.object({
    source_ids: z.array(sourceId).min(1), claim: z.string().min(1), type: z.string(), external_validity: z.string(), last_reviewed: z.iso.date(),
  })),
  platforms: z.record(z.enum(['instagram', 'linkedin', 'facebook', 'threads', 'pinterest', 'x']), z.object({
    scope: z.string(), formats: z.array(z.string()), verified_rules: z.array(platformRule),
    advisories: z.array(platformRule), not_verified: z.array(z.string()),
  })),
})

function index<T extends { id: string }>(entries: T[]) {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  if (byId.size !== entries.length) throw Error('ID duplicado no catálogo editorial.')
  return byId
}

export function validateKnowledge(input: unknown) {
  const catalog = knowledgeSchema.parse(input)
  const rules = index(catalog.rules)
  const sources = index(catalog.sources)
  const evidence = new Map(Object.entries(catalog.evidence))
  for (const [id, item] of evidence) {
    if (item.source_ids.some(source => !sources.has(source))) throw Error(`Fonte ausente para ${id}.`)
  }
  for (const item of rules.values()) {
    if (item.sourceIds.some(id => !sources.has(id)) ||
      item.evidenceIds.some(id => !evidence.get(id)?.source_ids.every(source => item.sourceIds.includes(source)))) {
      throw Error(`Referência inválida na regra ${item.id}.`)
    }
  }
  for (const platform of Object.values(catalog.platforms)) {
    for (const item of [...platform.verified_rules, ...platform.advisories]) {
      if (item.source_id && !sources.has(item.source_id)) throw Error(`Fonte ausente para ${item.key}.`)
    }
  }
  return { version: catalog.version, edition: catalog.edition, rules, sources, evidence, platforms: catalog.platforms }
}

export const knowledge = validateKnowledge(data)

export function explainRule(id: string) {
  const rule = knowledge.rules.get(id)
  if (!rule) return undefined
  return {
    rule, version: knowledge.version,
    sources: rule.sourceIds.flatMap(id => knowledge.sources.get(id) ?? []),
    evidence: rule.evidenceIds.flatMap(id => knowledge.evidence.get(id) ?? []),
  }
}
