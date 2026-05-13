import tinycolor from 'tinycolor2'
import { getSchemeColorFromTheme } from './schemeColor'
import { getTextByPathList } from './utils'

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

  let borderWidth = isNoFill ? 0 : (parseInt(getTextByPathList(lineNode, ['attrs', 'w'])) / 12700)
  if (isNaN(borderWidth)) {
    const hasLineNode = lineNode && lineNode !== node
    borderWidth = hasLineNode ? 9525 / 12700 : 0
  }

  let borderColor = getTextByPathList(lineNode, ['a:solidFill', 'a:srgbClr', 'attrs', 'val'])
  if (borderColor) {
    const alpha = getTextByPathList(lineNode, ['a:solidFill', 'a:srgbClr', 'a:alpha', 'attrs', 'val'])
    if (alpha) {
      const a = parseInt(alpha) / 100000
      borderColor = tinycolor({ r: parseInt(borderColor.slice(0, 2), 16), g: parseInt(borderColor.slice(2, 4), 16), b: parseInt(borderColor.slice(4, 6), 16), a }).toRgbString()
    }
    else {
      borderColor = `#${borderColor}`
    }
  }

  if (!borderColor) {
    const schemeClrNode = getTextByPathList(lineNode, ['a:solidFill', 'a:schemeClr'])
    const schemeClr = 'a:' + getTextByPathList(schemeClrNode, ['attrs', 'val'])
    borderColor = getSchemeColorFromTheme(schemeClr, warpObj)
    if (borderColor) {
      borderColor = `#${borderColor}`
      const alpha = getTextByPathList(schemeClrNode, ['a:alpha', 'attrs', 'val'])
      const shade = getTextByPathList(schemeClrNode, ['a:shade', 'attrs', 'val'])
      if (shade) {
        const s = parseInt(shade) / 100000
        const color = tinycolor(borderColor).toHsl()
        borderColor = tinycolor({ h: color.h, s: color.s, l: color.l * s }).toHexString()
      }
      if (alpha) {
        const a = parseInt(alpha) / 100000
        borderColor = tinycolor(borderColor).setAlpha(a).toRgbString()
      }
    }
  }

  if (!borderColor) {
    const schemeClrNode = getTextByPathList(node, ['p:style', 'a:lnRef', 'a:schemeClr'])
    const schemeClr = 'a:' + getTextByPathList(schemeClrNode, ['attrs', 'val'])
    borderColor = getSchemeColorFromTheme(schemeClr, warpObj)

    if (borderColor) {
      borderColor = `#${borderColor}`
      const shade = getTextByPathList(schemeClrNode, ['a:shade', 'attrs', 'val'])
      if (shade) {
        const s = parseInt(shade) / 100000
        const color = tinycolor(borderColor).toHsl()
        borderColor = tinycolor({ h: color.h, s: color.s, l: color.l * s }).toHexString()
      }
      const alpha = getTextByPathList(schemeClrNode, ['a:alpha', 'attrs', 'val'])
      if (alpha) {
        const a = parseInt(alpha) / 100000
        borderColor = tinycolor(borderColor).setAlpha(a).toRgbString()
      }
    }
  }

  if (!borderColor) borderColor = '#000000'

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