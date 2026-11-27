type Choice = { request: { key: string }; candidate: { credit: { sourceId: string } }; score: number }

// Minimum-cost assignment with one dummy column per slide. The real edges
// take priority over empty frames, then maximize fit across the narrative.
export function narrativeAssignment<T extends Choice>(choices: T[]) {
  const slideIds = [...new Set(choices.map(choice => choice.request.key))]
  const assetIds = [...new Set(choices.map(choice => choice.candidate.credit.sourceId))]
  if (!slideIds.length) return []
  const lookup = new Map<string, Map<string, T>>()
  for (const choice of choices) {
    const row = lookup.get(choice.request.key) ?? new Map()
    const existing = row.get(choice.candidate.credit.sourceId)
    if (!existing || choice.score > existing.score) row.set(choice.candidate.credit.sourceId, choice)
    lookup.set(choice.request.key, row)
  }
  const rows = slideIds.length
  const columns = assetIds.length + rows
  const priority = 1 + rows * Math.max(...choices.map(choice => choice.score))
  const rowPotential = new Float64Array(rows + 1)
  const columnPotential = new Float64Array(columns + 1)
  const assignment = new Int32Array(columns + 1)
  const previous = new Int32Array(columns + 1)
  for (let row = 1; row <= rows; row++) {
    assignment[0] = row
    let column = 0
    const distances = new Float64Array(columns + 1).fill(Infinity)
    const visited = new Uint8Array(columns + 1)
    do {
      visited[column] = 1
      const activeRow = assignment[column]
      const edges = lookup.get(slideIds[activeRow - 1])
      let next = 0
      let delta = Infinity
      for (let option = 1; option <= columns; option++) {
        if (visited[option]) continue
        const edge = edges?.get(assetIds[option - 1])
        const cost = edge ? -priority - edge.score : option <= assetIds.length ? priority : 0
        const distance = cost - rowPotential[activeRow] - columnPotential[option]
        if (distance < distances[option]) {
          distances[option] = distance
          previous[option] = column
        }
        if (distances[option] < delta) {
          delta = distances[option]
          next = option
        }
      }
      for (let option = 0; option <= columns; option++) {
        if (visited[option]) {
          rowPotential[assignment[option]] += delta
          columnPotential[option] -= delta
        } else distances[option] -= delta
      }
      column = next
    } while (assignment[column] !== 0)
    do {
      const prior = previous[column]
      assignment[column] = assignment[prior]
      column = prior
    } while (column !== 0)
  }
  return assetIds.flatMap((id, index) => {
    const edge = lookup.get(slideIds[assignment[index + 1] - 1])?.get(id)
    return edge ? [edge] : []
  }).sort((a, b) => b.score - a.score)
}
