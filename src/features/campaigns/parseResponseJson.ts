/** Some rich-text editors export copied JSON as escaped Markdown. */
export function parseResponseJson(text: string): unknown {
  try { return JSON.parse(text) } catch {
    // Only retry the recognizable rich-text export, never rewrite valid JSON.
    if (!/^&#x20;/m.test(text) || !/\\\n/.test(text)) throw Error('Cole um JSON válido ou use o modelo Markdown.')
    const restored = text
      .replace(/^(?:&#x20;)+/gm, spaces => ' '.repeat(spaces.length / 6))
      .replace(/\\\n/g, '\n')
      .replace(/\\([:.])/g, '$1')
    try { return JSON.parse(restored) } catch {
      throw Error('O texto veio com formatação de Markdown e ainda contém JSON inválido. Copie o bloco de código JSON ou carregue o arquivo .json original.')
    }
  }
}
