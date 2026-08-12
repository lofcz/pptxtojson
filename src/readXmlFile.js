import * as txml from 'txml/txml'

let cust_attr_order = 0

// simplifyLostLess() flattens the txml tree into keyed objects, which loses
// the exact child ordering OMML conversion depends on. For math roots we keep
// the original txml node (non-enumerable, so tree walkers don't see it) and
// hand it to dwml-ts untouched.
const RAW_NODE_TAGS = new Set(['m:oMath', 'm:oMathPara'])

function isWhitespaceTextNode(node) {
  return typeof node === 'string' && node.trim() === ''
}

export function simplifyLostLess(children, parentAttributes = {}) {
  const out = {}
  if (!children.length) return out

  if (children.length === 1 && typeof children[0] === 'string') {
    return Object.keys(parentAttributes).length ? {
      attrs: { order: cust_attr_order++, ...parentAttributes },
      value: children[0],
    } : children[0]
  }
  for (const child of children) {
    if (isWhitespaceTextNode(child)) continue
    if (typeof child !== 'object') return
    if (child.tagName === '?xml') continue

    if (!out[child.tagName]) out[child.tagName] = []

    const kids = simplifyLostLess(child.children || [], child.attributes)
    
    if (typeof kids === 'object') {
      if (!kids.attrs) kids.attrs = { order: cust_attr_order++ }
      else kids.attrs.order = cust_attr_order++

      if (RAW_NODE_TAGS.has(child.tagName)) {
        Object.defineProperty(kids, '__rawNode', { value: child, enumerable: false })
      }
    }
    if (Object.keys(child.attributes || {}).length) {
      kids.attrs = { ...kids.attrs, ...child.attributes }
    }
    out[child.tagName].push(kids)
  }
  for (const child in out) {
    if (out[child].length === 1) out[child] = out[child][0]
  }

  return out
}

export async function readXmlFile(zip, filename) {
  try {
    const file = zip.file(filename)
    if (!file) return null
    const data = await file.async('string')
    return simplifyLostLess(txml.parse(data, { keepWhitespace: true }))
  }
  catch {
    return null
  }
}