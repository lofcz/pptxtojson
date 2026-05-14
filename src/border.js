import { getSolidFill, getGradientFill } from './fill'
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
  const hasFill = lineNode['a:solidFill'] || lineNode['a:gradFill']
  const hasWidth = getTextByPathList(lineNode, ['attrs', 'w']) !== undefined

  let borderWidth = isNoFill ? 0 : (parseInt(getTextByPathList(lineNode, ['attrs', 'w'])) / 12700)
  if (isNaN(borderWidth)) {
    const hasLineNode = lineNode && lineNode !== node
    borderWidth = (hasLineNode && (hasFill || hasWidth)) ? 9525 / 12700 : 0
  }

  let borderColor = null

  if (lineNode['a:solidFill']) {
    const color = getSolidFill(lineNode['a:solidFill'], undefined, undefined, warpObj)
    if (color) borderColor = { type: 'color', value: color }
  }

  if (!borderColor) {
    const lnRefFill = getTextByPathList(node, ['p:style', 'a:lnRef'])
    if (lnRefFill) {
      const color = getSolidFill(lnRefFill, undefined, undefined, warpObj)
      if (color) borderColor = { type: 'color', value: color }
    }
  }

  if (!borderColor && lineNode['a:gradFill']) {
    const gradValue = getGradientFill(lineNode['a:gradFill'], warpObj)
    if (gradValue && gradValue.colors && gradValue.colors.length > 0) {
      borderColor = { type: 'gradient', value: gradValue }
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
