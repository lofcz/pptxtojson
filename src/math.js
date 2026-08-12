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
    if (latex) runs.push({ type: 'math', latex, node, attrs: { order } })
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

const findMathRunPr = (node, skipCtrlPr) => {
  if (!node || typeof node !== 'object') return null
  if (node['a:rPr']) {
    const rPr = node['a:rPr']
    return Array.isArray(rPr) ? rPr[0] : rPr
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'attrs' || (skipCtrlPr && key === 'm:ctrlPr')) continue
    for (const child of toArray(value)) {
      const found = findMathRunPr(child, skipCtrlPr)
      if (found) return found
    }
  }
  return null
}

/**
 * Resolve the run properties that size/color an equation. Math glyph runs
 * (`m:r > a:rPr`) carry the visible size; `m:ctrlPr` is only a fallback since
 * it describes the control characters, not the rendered operands. Returns a
 * node shaped like a text run so the standard fontStyle resolution chain
 * (run -> paragraph -> layout -> master) applies unchanged.
 */
export function getMathRunStyleNode(mathRun) {
  const mathNode = mathRun && mathRun.node
  const rPr = findMathRunPr(mathNode, true) || findMathRunPr(mathNode, false)
  return rPr ? { 'a:rPr': rPr } : {}
}

/** True when the math run's own properties pin a font size. */
export function mathRunHasOwnSize(styleNode) {
  const rPr = styleNode && styleNode['a:rPr']
  return !!(rPr && rPr.attrs && rPr.attrs.sz)
}

/** True when the math run's own properties pin a fill color. */
export function mathRunHasOwnColor(styleNode) {
  const rPr = styleNode && styleNode['a:rPr']
  return !!(rPr && (rPr['a:solidFill'] || rPr['a:gradFill'] || rPr['a:pattFill']))
}

export function latexFormart(latex) {
  return latex.replaceAll(/&lt;/g, '<')
    .replaceAll(/&gt;/g, '>')
    .replaceAll(/&amp;/g, '&')
    .replaceAll(/&apos;/g, "'")
    .replaceAll(/&quot;/g, '"')
}
