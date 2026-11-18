export function editorialImageQuery(brief: string | undefined, title: string) {
  return (brief?.trim() || title.trim()).replace(/\s+/g, ' ').slice(0, 160)
}
