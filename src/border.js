import tinycolor from 'tinycolor2'
import { getSchemeColorFromTheme } from './schemeColor'
import { getTextByPathList, angleToDegrees } from './utils'

function resolveSchemeColor(schemeClrNode, baseColor) {
  let color = baseColor
  const shade = getTextByPathList(schemeClrNode, ['a:shade', 'attrs', 'val'])
  if (shade) {
    const s = parseInt(shade) / 100000
    const hsl = tinycolor(color).toHsl()
    color = tinycolor({ h: hsl.h, s: hsl.s, l: hsl.l * s }).toHexString()
  }
  const alpha = getTextByPathList(schemeClrNode, ['a:alpha', 'attrs', 'val'])
  if (alpha) {
    const a = parseInt(alpha) / 100000
    color = tinycolor(color).setAlpha(a).toRgbString()
  }
  return color
}

export function getBorder(node, elType, warpObj) {
  let lineNode = getTextByPathList(node, ['p:spPr', 'a:ln'])
  if (!lineNode) {
    const lnRefNode = getTextByPathList(node, ['p:style', 'a:lnRef'])
    if (lnRefNode) {
      const lnIdx = getTextByPathList(lnRefNode, ['attrs', 'idx'])
      lineNode = warpObj['themeContent']['a:theme']['a:themeElements']['a:fmtScheme']['a:lnStyleLst']['a:ln'][Number(lnIdx) - 1]
    }
  }
  if (!lineNode) lineNode = node

  const isNoFill = getTextByPathList(lineNode, ['a:noFill'])
  const hasFill = lineNode['a:solidFill'] || lineNode['a:gradFill']
  const hasWidth = getTextByPathList(lineNode, ['attrs', 'w']) !== undefined

  let borderWidth = isNoFill ? 0 : (parseInt(getTextByPathList(lineNode, ['attrs', 'w'])) / 12700)
  if (isNaN(borderWidth)) {
    const hasLineNode = lineNode && lineNode !== node
    borderWidth = (hasLineNode && (hasFill || hasWidth)) ? 9525 / 12700 : 0
  }

  let borderColor = null

  const srgbVal = getTextByPathList(lineNode, ['a:solidFill', 'a:srgbClr', 'attrs', 'val'])
  if (srgbVal) {
    let color = `#${srgbVal}`
    const alpha = getTextByPathList(lineNode, ['a:solidFill', 'a:srgbClr', 'a:alpha', 'attrs', 'val'])
    if (alpha) {
      const a = parseInt(alpha) / 100000
      color = tinycolor(color).setAlpha(a).toRgbString()
    }
    borderColor = { type: 'color', value: color }
  }

  if (!borderColor) {
    const schemeClrNode = getTextByPathList(lineNode, ['a:solidFill', 'a:schemeClr'])
    const resolved = getSchemeColorFromTheme('a:' + getTextByPathList(schemeClrNode, ['attrs', 'val']), warpObj)
    if (resolved) {
      borderColor = { type: 'color', value: resolveSchemeColor(schemeClrNode, `#${resolved}`, warpObj) }
    }
  }

  if (!borderColor) {
    const schemeClrNode = getTextByPathList(node, ['p:style', 'a:lnRef', 'a:schemeClr'])
    const resolved = getSchemeColorFromTheme('a:' + getTextByPathList(schemeClrNode, ['attrs', 'val']), warpObj)
    if (resolved) {
      borderColor = { type: 'color', value: resolveSchemeColor(schemeClrNode, `#${resolved}`, warpObj) }
    }
  }

  if (!borderColor) {
    const gradFillNode = getTextByPathList(lineNode, ['a:gradFill'])
    if (gradFillNode) {
      const gsLst = getTextByPathList(gradFillNode, ['a:gsLst', 'a:gs'])
      if (gsLst) {
        const gsArr = Array.isArray(gsLst) ? gsLst : [gsLst]
        const colors = gsArr.map(gs => {
          const pos = getTextByPathList(gs, ['attrs', 'pos'])
          let color = ''
          const srgbClr = getTextByPathList(gs, ['a:srgbClr', 'attrs', 'val'])
          if (srgbClr) {
            color = `#${srgbClr}`
          }
          else {
            const schemeClr = 'a:' + getTextByPathList(gs, ['a:schemeClr', 'attrs', 'val'])
            const resolved = getSchemeColorFromTheme(schemeClr, warpObj)
            if (resolved) color = `#${resolved}`
          }
          if (color) {
            const clrNode = getTextByPathList(gs, ['a:schemeClr']) || getTextByPathList(gs, ['a:srgbClr'])
            const alphaVal = getTextByPathList(clrNode, ['a:alpha', 'attrs', 'val'])
            if (alphaVal) {
              color = tinycolor(color).setAlpha(parseInt(alphaVal) / 100000).toRgbString()
            }
          }
          return { pos: pos ? (parseInt(pos) / 1000 + '%') : '0%', color }
        }).filter(c => c.color)

        const linNode = getTextByPathList(gradFillNode, ['a:lin'])
        let rot = 0
        if (linNode) rot = angleToDegrees(getTextByPathList(linNode, ['attrs', 'ang'])) + 90

        if (colors.length > 0) {
          borderColor = { type: 'gradient', value: { colors, rot } }
        }
      }
    }
  }

  if (!borderColor) borderColor = { type: 'color', value: '#000000' }

  const type = getTextByPathList(lineNode, ['a:prstDash', 'attrs', 'val'])
  let borderType = 'solid'
  let strokeDasharray = '0'
  switch (type) {
    case 'solid':
      borderType = 'solid'
      strokeDasharray = '0'
      break
    case 'dash':
      borderType = 'dashed'
      strokeDasharray = '5'
      break
    case 'dashDot':
      borderType = 'dashed'
      strokeDasharray = '5, 5, 1, 5'
      break
    case 'dot':
      borderType = 'dotted'
      strokeDasharray = '1, 5'
      break
    case 'lgDash':
      borderType = 'dashed'
      strokeDasharray = '10, 5'
      break
    case 'lgDashDotDot':
      borderType = 'dotted'
      strokeDasharray = '10, 5, 1, 5, 1, 5'
      break
    case 'sysDash':
      borderType = 'dashed'
      strokeDasharray = '5, 2'
      break
    case 'sysDashDot':
      borderType = 'dotted'
      strokeDasharray = '5, 2, 1, 5'
      break
    case 'sysDashDotDot':
      borderType = 'dotted'
      strokeDasharray = '5, 2, 1, 5, 1, 5'
      break
    case 'sysDot':
      borderType = 'dotted'
      strokeDasharray = '2, 5'
      break
    default:
  }

  return {
    borderColor,
    borderWidth,
    borderType,
    strokeDasharray,
  }
}
