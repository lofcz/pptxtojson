import { getTextByPathList } from './utils'

export function findTransitionNode(content, rootElement) {
  if (!content || !rootElement) return null

  const path1 = [rootElement, 'p:transition']
  let transitionNode = getTextByPathList(content, path1)
  if (transitionNode) return transitionNode

  const path2 = [rootElement, 'mc:AlternateContent', 'mc:Choice', 'p:transition']
  transitionNode = getTextByPathList(content, path2)
  if (transitionNode) return transitionNode

  const path3 = [rootElement, 'mc:AlternateContent', 'mc:Fallback', 'p:transition']
  transitionNode = getTextByPathList(content, path3)
  
  return transitionNode
}

export function parseTransition(transitionNode) {
  if (!transitionNode) return null

  const transition = {
    type: 'none',
    duration: 1000,
    direction: null,
  }

  const attrs = transitionNode.attrs || {}

  let durationFound = false
  const durRegex = /^p\d{2}:dur$/ 
  for (const key in attrs) {
    if (durRegex.test(key) && !isNaN(parseInt(attrs[key], 10))) {
      transition.duration = parseInt(attrs[key], 10)
      durationFound = true
      break
    }
  }

  if (!durationFound && attrs.spd) {
    switch (attrs.spd) {
      case 'slow':
        transition.duration = 1000
        break
      case 'med':
        transition.duration = 800
        break
      case 'fast':
        transition.duration = 500
        break
      default:
        transition.duration = 1000
        break
    }
  }

  if (attrs.advClick === '0' && attrs.advTm) {
    transition.autoNextAfter = parseInt(attrs.advTm, 10)
  }

  const effectRegex = /^(p|p\d{2}):/ 
  for (const key in transitionNode) {
    if (key !== 'attrs' && effectRegex.test(key)) {
      const effectNode = transitionNode[key]
      transition.type = key.substring(key.indexOf(':') + 1)

      if (effectNode && effectNode.attrs) {
        const effectAttrs = effectNode.attrs
        
        if (effectAttrs.dur && !isNaN(parseInt(effectAttrs.dur, 10))) {
          if (!durationFound) transition.duration = parseInt(effectAttrs.dur, 10)
        }
        if (effectAttrs.dir) transition.direction = effectAttrs.dir
      }
      break
    }
  }

  return transition
}

const PRESET_CLASSES = new Set(['entr', 'exit', 'emph', 'path', 'verb', 'mediacall'])

const NODE_TYPE_TO_TRIGGER = {
  clickEffect: 'onClick',
  withEffect: 'withPrevious',
  afterEffect: 'afterPrevious',
  clickPar: 'onClick',
  withGroup: 'withPrevious',
  afterGroup: 'afterPrevious',
  interactiveSeq: 'onClick',
}

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function parseMs(value) {
  if (value == null || value === '' || value === 'indefinite') return null
  const ms = parseInt(value, 10)
  return Number.isFinite(ms) ? ms : null
}

function findTimingNode(content) {
  if (!content) return null
  return getTextByPathList(content, ['p:sld', 'p:timing'])
    || getTextByPathList(content, ['p:sld', 'mc:AlternateContent', 'mc:Choice', 'p:timing'])
    || getTextByPathList(content, ['p:sld', 'mc:AlternateContent', 'mc:Fallback', 'p:timing'])
}

function collectSpids(node, out = []) {
  if (!node || typeof node !== 'object') return out
  const spid = node.attrs?.spid
  if (spid != null && spid !== '') out.push(String(spid))
  for (const key of Object.keys(node)) {
    if (key === 'attrs' || key === 'value') continue
    for (const child of asArray(node[key])) collectSpids(child, out)
  }
  return out
}

function collectDuration(node) {
  let found = null
  const walk = n => {
    if (!n || typeof n !== 'object') return
    const ms = parseMs(n.attrs?.dur)
    if (ms != null && ms >= 0) found = ms
    for (const key of Object.keys(n)) {
      if (key === 'attrs' || key === 'value') continue
      for (const child of asArray(n[key])) walk(child)
    }
  }
  walk(node)
  return found
}

function collectFilter(node) {
  let filter = ''
  const walk = n => {
    if (!n || typeof n !== 'object') return
    if (n.attrs?.filter) filter = n.attrs.filter
    for (const key of Object.keys(n)) {
      if (key === 'attrs' || key === 'value') continue
      for (const child of asArray(n[key])) walk(child)
    }
  }
  walk(node)
  return filter
}

function collectDelay(node, inherited = 0) {
  const fromAttr = parseMs(node?.attrs?.delay)
  if (fromAttr != null && fromAttr >= 0) return fromAttr

  const condRoot = node?.['p:stCondLst']
  for (const cond of asArray(condRoot?.['p:cond'] || condRoot)) {
    const fromCond = parseMs(cond?.attrs?.delay)
    if (fromCond != null && fromCond >= 0) return fromCond
  }
  return inherited
}

function collectEffects(node, inheritedTrigger = 'onClick', inheritedDelay = 0, results = []) {
  if (!node || typeof node !== 'object') return results

  const attrs = node.attrs || {}
  const trigger = NODE_TYPE_TO_TRIGGER[attrs.nodeType] || inheritedTrigger
  const delay = collectDelay(node, inheritedDelay)

  if (attrs.presetClass && PRESET_CLASSES.has(attrs.presetClass)) {
    const spids = [...new Set(collectSpids(node))]
    const duration = collectDuration(node)
    const filter = collectFilter(node)
    const effectTrigger = NODE_TYPE_TO_TRIGGER[attrs.nodeType] || trigger
    for (const spid of spids) {
      const animation = {
        spid,
        trigger: effectTrigger,
        class: attrs.presetClass,
        presetId: parseInt(attrs.presetID || '0', 10) || 0,
        presetSubtype: parseInt(attrs.presetSubtype || '0', 10) || 0,
        duration: duration != null ? duration : 1000,
        delay,
      }
      if (filter) animation.filter = filter
      results.push(animation)
    }
    return results
  }

  for (const key of Object.keys(node)) {
    if (key === 'attrs' || key === 'value') continue
    for (const child of asArray(node[key])) {
      collectEffects(child, trigger, delay, results)
    }
  }
  return results
}

function parseBuildList(timing) {
  const bldLst = timing?.['p:bldLst']
  if (!bldLst) return []

  const kinds = [
    ['p:bldP', 'paragraph'],
    ['p:bldDgm', 'diagram'],
    ['p:bldGraphic', 'graphic'],
    ['p:bldOleChart', 'oleChart'],
  ]
  const builds = []
  for (const [tag, type] of kinds) {
    for (const node of asArray(bldLst[tag])) {
      const spid = node?.attrs?.spid
      if (spid == null || spid === '') continue
      const item = { spid: String(spid), type }
      if (node.attrs?.animBg === '1' || node.attrs?.animBg === 'true') item.animBg = true
      builds.push(item)
    }
  }
  return builds
}

/**
 * Parse `p:timing` click/build animations and `p:bldLst` from a slide part.
 * Effect nodes are `p:cTn` with `presetClass`; `nodeType` may live on an ancestor.
 * Document order is the presenter sequence.
 */
export function parseTiming(slideContent) {
  const timing = findTimingNode(slideContent)
  if (!timing) return { animations: [], builds: [] }
  return {
    animations: collectEffects(timing),
    builds: parseBuildList(timing),
  }
}