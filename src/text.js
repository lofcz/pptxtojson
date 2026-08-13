import { getHorizontalAlign, getParagraphSpacing, getParagraphIndent, getParagraphStyleNodes } from './paragraph'
import { getTextByPathList, escapeHtml } from './utils'
import { getInlineMathRuns, getMathRunStyleNode, mathRunHasOwnSize, mathRunHasOwnColor } from './math'
import { getFillType } from './fill'
import { getSchemeColorFromTheme } from './schemeColor'

import {
  getFontType,
  getFontColor,
  getFontSize,
  getFontBold,
  getFontItalic,
  getFontDecoration,
  getFontDecorationLine,
  getFontSpace,
  getFontSubscript,
  getFontShadow,
} from './fontStyle'

export function getTextNodeValue(node) {
  if (typeof node === 'string') return node
  if (node && typeof node.value === 'string') return node.value
  return undefined
}

export function genTextBody(textBodyNode, spNode, slideLayoutSpNode, slideMasterSpNode, type, warpObj) {
  if (!textBodyNode) return ''

  let text = ''

  const pFontStyle = getTextByPathList(spNode, ['p:style', 'a:fontRef'])
  const slideMasterTextStyles = spNode && spNode['a:tcPr'] ? undefined : warpObj['slideMasterTextStyles']
  const defaultTextStyle = spNode && spNode['a:tcPr'] ? warpObj['defaultTextStyle'] : undefined

  const pNode = textBodyNode['a:p']
  const pNodes = pNode.constructor === Array ? pNode : [pNode]

  const listTypes = []

  for (const pNode of pNodes) {
    let rNode = pNode['a:r']
    let fldNode = pNode['a:fld']
    let brNode = pNode['a:br']
    if (rNode) {
      rNode = (rNode.constructor === Array) ? rNode : [rNode]

      if (fldNode) {
        fldNode = (fldNode.constructor === Array) ? fldNode : [fldNode]
        rNode = rNode.concat(fldNode)
      }
      if (brNode) {
        brNode = (brNode.constructor === Array) ? brNode : [brNode]
        brNode.forEach(item => item.type = 'br')
  
        if (brNode.length > 1) brNode.shift()
        rNode = rNode.concat(brNode)
        rNode.sort((a, b) => {
          if (!a.attrs || !b.attrs) return true
          return a.attrs.order - b.attrs.order
        })
      }
    }

    // Inline OMML math (<a14:m>/<m:oMath> siblings of <a:r>) — merge into the
    // run list by document order so equations keep their place in the text.
    const mathRuns = getInlineMathRuns(pNode)
    if (mathRuns.length) {
      rNode = (rNode || []).concat(mathRuns)
      rNode.sort((a, b) => ((a.attrs && a.attrs.order) || 0) - ((b.attrs && b.attrs.order) || 0))
    }

    const align = getHorizontalAlign(pNode, spNode, type, slideLayoutSpNode, slideMasterSpNode, warpObj)
    const spacing = getParagraphSpacing(pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, warpObj)
    const indent = getParagraphIndent(pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, warpObj)
    const listType = getListType(pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, warpObj)
    const listLevel = getListLevel(pNode)

    let alignStyle = align
    if (align === 'distribute') alignStyle = 'justify'
    let styleText = `text-align: ${alignStyle};`
    if (align === 'distribute') styleText += `text-align-last: justify;text-justify: distribute;`
    if (spacing) {
      if (spacing.lineSpacing) styleText += `line-height: ${spacing.lineSpacing};`
      else styleText += `line-height: 1.2;`
      if (spacing.spaceBefore) styleText += `margin-top: ${spacing.spaceBefore};`
      if (spacing.spaceAfter) styleText += `margin-bottom: ${spacing.spaceAfter};`
    }
    else styleText += `line-height: 1.2;`
    if (indent) {
      if (!listType && indent.marginLeft) styleText += `margin-left: ${indent.marginLeft};`
      if (!listType && indent.textIndent) styleText += `text-indent: ${indent.textIndent};`
    }

    if (listType) {
      while (listTypes.length > listLevel + 1) {
        const closedListType = listTypes.pop()
        text += `</${closedListType}>`
      }

      if (listTypes[listLevel] === undefined) {
        text += `<${listType}>`
        listTypes[listLevel] = listType
      }
      else if (listTypes[listLevel] !== listType) {
        text += `</${listTypes[listLevel]}>`
        text += `<${listType}>`
        listTypes[listLevel] = listType
      }
      text += `<li><p style="${styleText}">`
    }
    else {
      while (listTypes.length > 0) {
        const closedListType = listTypes.pop()
        text += `</${closedListType}>`
      }
      text += `<p style="${styleText}">`
    }
    
    if (!rNode) {
      text += genSpanElement(pNode, spNode, textBodyNode, pFontStyle, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, defaultTextStyle, warpObj)
    } 
    else {
      let prevStyleInfo = null
      let accumulatedText = ''

      // Nearest sibling text run supplies size/color a math run doesn't pin
      // itself — inline equations must look like the text they sit in.
      const firstTextRun = rNode.find(item => !item.type)
      let lastTextRun = null

      for (const rNodeItem of rNode) {
        if (rNodeItem.type === 'math') {
          if (accumulatedText && prevStyleInfo) {
            const processedText = accumulatedText.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\s/g, '&nbsp;')
            text += `<span style="${prevStyleInfo.styleText}">${processedText}</span>`
          }
          accumulatedText = ''
          prevStyleInfo = null

          const latex = escapeHtml(rNodeItem.latex)
          const siblingRun = lastTextRun || firstTextRun
          const mathStyle = getMathRunStyleText(rNodeItem, siblingRun, pNode, textBodyNode, pFontStyle, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, defaultTextStyle, warpObj)
          text += `<span class="omml-math" data-latex="${latex}"${mathStyle ? ` style="${mathStyle}"` : ''}>${latex}</span>`
          continue
        }
        if (!rNodeItem.type) lastTextRun = rNodeItem

        const styleInfo = getSpanStyleInfo(rNodeItem, pNode, textBodyNode, pFontStyle, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, defaultTextStyle, warpObj)

        if (!prevStyleInfo || prevStyleInfo.styleText !== styleInfo.styleText || prevStyleInfo.hasLink !== styleInfo.hasLink || styleInfo.hasLink) {
          if (accumulatedText) {
            const processedText = accumulatedText.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\s/g, '&nbsp;')
            text += `<span style="${prevStyleInfo.styleText}">${processedText}</span>`
            accumulatedText = ''
          }

          if (styleInfo.hasLink) {
            const processedText = styleInfo.text.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\s/g, '&nbsp;')
            text += `<span style="${styleInfo.styleText}"><a href="${styleInfo.linkURL}" target="_blank">${processedText}</a></span>`
            prevStyleInfo = null
          } 
          else {
            prevStyleInfo = styleInfo
            accumulatedText = styleInfo.text
          }
        } 
        else accumulatedText += styleInfo.text
      }

      if (accumulatedText && prevStyleInfo) {
        const processedText = accumulatedText.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\s/g, '&nbsp;')
        text += `<span style="${prevStyleInfo.styleText}">${processedText}</span>`
      }
    }

    if (listType) text += '</p></li>'
    else text += '</p>'
  }
  while (listTypes.length > 0) {
    const closedListType = listTypes.pop()
    text += `</${closedListType}>`
  }
  return text
}

/**
 * Style text for an inline equation. Attributes the math run pins itself
 * (`m:r > a:rPr`) win; anything unspecified inherits from the nearest sibling
 * text run — matching how PowerPoint/LibreOffice render equations embedded in
 * a line of text — before falling back to the usual paragraph/layout/master
 * chain for math-only paragraphs.
 */
function getMathRunStyleText(mathRun, siblingRun, pNode, textBodyNode, pFontStyle, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, defaultTextStyle, warpObj) {
  let lvl = 1
  const lvlNode = getTextByPathList(pNode, ['a:pPr', 'attrs', 'lvl'])
  if (lvlNode !== undefined) lvl = parseInt(lvlNode) + 1

  const styleNode = getMathRunStyleNode(mathRun)
  const sizeNode = mathRunHasOwnSize(styleNode) || !siblingRun ? styleNode : siblingRun
  const colorNode = mathRunHasOwnColor(styleNode) || !siblingRun ? styleNode : siblingRun

  const fontSize = getFontSize(sizeNode, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl, defaultTextStyle)
  const fontColor = getFontColor(colorNode, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl, pFontStyle, warpObj)

  let styleText = ''
  if (fontSize) styleText += `font-size: ${fontSize};`
  if (fontColor && typeof fontColor === 'string') styleText += `color: ${fontColor};`
  return styleText
}

export function getListType(node, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, warpObj) {
  const hasContent = node['a:r'] || node['a:br'] || node['a:fld']
  if (!hasContent) return ''

  const styleNodes = getParagraphStyleNodes(node, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, warpObj)
  if (!styleNodes) return ''

  for (const styleNode of styleNodes) {
    if (styleNode['a:buNone']) return ''
    if (styleNode['a:buChar'] || styleNode['a:buBlip']) return 'ul'
    if (styleNode['a:buAutoNum']) return 'ol'
  }

  return ''
}
export function getListLevel(node) {
  const pPrNode = node['a:pPr']
  if (!pPrNode) return 0

  const lvlNode = getTextByPathList(pPrNode, ['attrs', 'lvl'])
  if (lvlNode !== undefined) return parseInt(lvlNode)

  return 0
}

function schemeColorToCss(color) {
  if (!color) return ''
  return color.startsWith('#') ? color : `#${color}`
}

function applyHyperlinkRunStyle(styleText, node, warpObj) {
  let next = styleText
  const runStyleNode = getTextByPathList(node, ['a:rPr'])
  const runFill = runStyleNode ? getFillType(runStyleNode) : ''
  const runHasOwnColor = runFill === 'SOLID_FILL' || runFill === 'GRADIENT_FILL'
  if (!runHasOwnColor) {
    const hlinkColor = schemeColorToCss(getSchemeColorFromTheme('a:hlink', warpObj)) || '#0563C1'
    if (/color\s*:/.test(next)) next = next.replace(/color\s*:\s*[^;]+;/, `color: ${hlinkColor};`)
    else next += `color: ${hlinkColor};`
  }

  const runUnderline = getTextByPathList(node, ['a:rPr', 'attrs', 'u'])
  if (runUnderline !== 'none' && !/text-decoration\s*:\s*underline/.test(next)) {
    next += 'text-decoration: underline;'
  }

  return next
}

export function genSpanElement(node, pNode, textBodyNode, pFontStyle, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, defaultTextStyle, warpObj) {
  const { styleText, text, hasLink, linkURL } = getSpanStyleInfo(node, pNode, textBodyNode, pFontStyle, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, defaultTextStyle, warpObj)
  const processedText = text.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\s/g, '&nbsp;')

  if (hasLink) {
    return `<span style="${styleText}"><a href="${linkURL}" target="_blank">${processedText}</a></span>`
  }
  return `<span style="${styleText}">${processedText}</span>`
}

export function getSpanStyleInfo(node, pNode, textBodyNode, pFontStyle, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, defaultTextStyle, warpObj) {
  let lvl = 1
  const pPrNode = pNode['a:pPr']
  const lvlNode = getTextByPathList(pPrNode, ['attrs', 'lvl'])
  if (lvlNode !== undefined) lvl = parseInt(lvlNode) + 1

  let text = getTextNodeValue(node['a:t'])
  if (typeof text !== 'string') text = getTextNodeValue(getTextByPathList(node, ['a:fld', 'a:t']))
  if (typeof text !== 'string') text = '&nbsp;'

  let styleText = ''
  const fontColor = getFontColor(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl, pFontStyle, warpObj)
  const fontSize = getFontSize(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl, defaultTextStyle)
  const fontType = getFontType(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl, warpObj, text)
  const fontBold = getFontBold(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl)
  const fontItalic = getFontItalic(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl)
  const fontDecoration = getFontDecoration(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl)
  const fontDecorationLine = getFontDecorationLine(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl)
  const fontSpace = getFontSpace(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl)
  const shadow = getFontShadow(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl, warpObj)
  const subscript = getFontSubscript(node, pNode, textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles, lvl)

  if (fontColor) {
    if (typeof fontColor === 'string') styleText += `color: ${fontColor};`
    else if (fontColor.colors) {
      const { colors, rot } = fontColor
      const stops = colors.map(item => `${item.color} ${item.pos}`).join(', ')
      const gradientStyle = `linear-gradient(${rot + 90}deg, ${stops})`
      styleText += `background: ${gradientStyle}; background-clip: text; color: transparent;`
    }
  }
  if (fontSize) styleText += `font-size: ${fontSize};`
  if (fontType) styleText += `font-family: ${fontType};`
  if (fontBold) styleText += `font-weight: ${fontBold};`
  if (fontItalic) styleText += `font-style: ${fontItalic};`
  if (fontDecoration) styleText += `text-decoration: ${fontDecoration};`
  if (fontDecorationLine) styleText += `text-decoration-line: ${fontDecorationLine};`
  if (fontSpace) styleText += `letter-spacing: ${fontSpace};`
  if (subscript) styleText += `vertical-align: ${subscript};`
  if (shadow) styleText += `text-shadow: ${shadow};`

  const linkID = getTextByPathList(node, ['a:rPr', 'a:hlinkClick', 'attrs', 'r:id'])
  const hasLink = linkID && warpObj['slideResObj'][linkID]
  if (hasLink) styleText = applyHyperlinkRunStyle(styleText, node, warpObj)

  return {
    styleText,
    text,
    hasLink,
    linkURL: hasLink ? warpObj['slideResObj'][linkID]['target'] : null
  }
}
