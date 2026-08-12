import { ommlNodeToLatex } from 'dwml-ts'

export function findOMath(obj) {
  let results = []
  if (typeof obj !== 'object') return results
  if (obj['m:oMath']) results = results.concat(obj['m:oMath'])
  
  Object.values(obj).forEach(value => {
    if (Array.isArray(value) || typeof value === 'object') {
      results = results.concat(findOMath(value))
    }
  })
  return results
}

/**
 * Convert a simplified oMath/oMathPara node to bare LaTeX.
 *
 * Conversion runs on the raw txml node retained by readXmlFile (`__rawNode`)
 * through dwml-ts — a port of the dwml OMML->LaTeX library — instead of the
 * lossy simplified tree. Returns '' when the node carries no convertible math.
 */
export function oMathToLatex(simplifiedNode) {
  const rawNode = simplifiedNode && simplifiedNode.__rawNode
  if (!rawNode) return ''
  return latexFormart(ommlNodeToLatex(rawNode)).trim()
}

const toArray = value => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Collect inline math runs of one `<a:p>` node: `<a14:m>` wrappers and bare
 * `<m:oMath>`/`<m:oMathPara>` siblings of the text runs. Each entry carries
 * the document-order attribute so it can be merged into the run list.
 */
export function getInlineMathRuns(pNode) {
  const runs = []
  const push = (node, order) => {
    const latex = oMathToLatex(node)
    if (latex) runs.push({ type: 'math', latex, attrs: { order } })
  }

  for (const wrapper of toArray(pNode['a14:m'])) {
    const order = (wrapper && wrapper.attrs && wrapper.attrs.order) || 0
    for (const key of ['m:oMath', 'm:oMathPara']) {
      for (const node of toArray(wrapper[key])) push(node, order)
    }
  }
  for (const key of ['m:oMath', 'm:oMathPara']) {
    for (const node of toArray(pNode[key])) {
      push(node, (node && node.attrs && node.attrs.order) || 0)
    }
  }
  return runs
}

export function latexFormart(latex) {
  return latex.replaceAll(/&lt;/g, '<')
    .replaceAll(/&gt;/g, '>')
    .replaceAll(/&amp;/g, '&')
    .replaceAll(/&apos;/g, "'")
    .replaceAll(/&quot;/g, '"')
}
