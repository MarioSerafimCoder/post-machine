export function DamagedProjects({ items }: { items: { id: string; name: string }[] }) {
  if (!items.length) return null
  return <div role="status">
    <p>Alguns projetos locais estão com dados inválidos. Se tiver uma cópia, restaure o ZIP no Studio.</p>
    <ul aria-label="Projetos com dados inválidos">
      {items.map((item, index) => <li key={index}>{item.name || 'Projeto sem nome'} · {item.id}</li>)}
    </ul>
  </div>
}
