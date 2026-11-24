export const productionOrigins = [
  { id: 'import', label: 'Importar conteúdo', description: 'Cole uma resposta do ChatGPT, Markdown ou texto.' },
  { id: 'radar', label: 'Explorar pautas', description: 'Comece a partir de uma notícia ou oportunidade do Radar.' },
  { id: 'blank', label: 'Começar do zero', description: 'Escreva seus slides e deixe o Studio montar o design.' },
] as const

export type ContentOrigin = typeof productionOrigins[number]['id']
