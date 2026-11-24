const HTML_ENTITIES: Record<string, string> = {
  '&quot;': '"',
  '&#039;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
}

/**
 * OrangeHRM server-renders each page as a Vue component tag whose props are bound
 * attributes holding HTML-escaped JSON, e.g. `<auth-login :token="&quot;abc&quot;">`.
 * Reads one prop of one component, scoped to that component's opening tag so a
 * same-named prop on another component is never matched. Returns undefined when the
 * page renders no such component or the component has no such prop.
 */
export function readComponentProp(html: string, componentTag: string, propName: string): unknown {
  const openingTag = new RegExp(`<${componentTag}\\b[^>]*>`).exec(html)?.[0]
  if (openingTag === undefined) return undefined

  const boundValue = new RegExp(`\\s:${propName}="([^"]*)"`).exec(openingTag)?.[1]
  if (boundValue === undefined) return undefined

  return JSON.parse(boundValue.replace(/&(quot|#0?39|lt|gt|amp);/g, (entity) => HTML_ENTITIES[entity]))
}

export function hasComponent(html: string, componentTag: string): boolean {
  return new RegExp(`<${componentTag}\\b`).test(html)
}
