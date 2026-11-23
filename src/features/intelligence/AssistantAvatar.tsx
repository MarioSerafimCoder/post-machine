import { useEditorialMemory } from './feedback'

export function AssistantAvatar() {
  const { mode } = useEditorialMemory()
  return <picture>
    <source media="(prefers-reduced-motion: reduce)" srcSet="/assistant/avatar.png" />
    <img src={mode === 'muted' ? '/assistant/avatar.png' : '/assistant/avatar.gif'} alt="" width="420" height="415" decoding="async" />
  </picture>
}
