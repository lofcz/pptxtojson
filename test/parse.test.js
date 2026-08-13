import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { parse } from '../dist/index.js'

const fixture = path => fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url))

const loadDeck = async name => {
  const buffer = readFileSync(fixture(name))
  return await parse(buffer.buffer, { imageMode: 'none' })
}

function effectCtn({ id, presetID, presetClass, presetSubtype = 0, nodeType, spid, dur = 1000, filter = 'fade', delay }) {
  const nodeTypeAttr = nodeType ? ` nodeType="${nodeType}"` : ''
  const delayAttr = delay != null ? ` delay="${delay}"` : ''
  return `<p:par>
    <p:cTn id="${id}" presetID="${presetID}" presetClass="${presetClass}" presetSubtype="${presetSubtype}"${nodeTypeAttr}${delayAttr} fill="hold">
      <p:childTnLst>
        <p:animEffect transition="in" filter="${filter}">
          <p:cBhvr><p:cTn dur="${dur}"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr>
        </p:animEffect>
      </p:childTnLst>
    </p:cTn>
  </p:par>`
}

function timingXml({ clickSpid, withSpid, afterSpid, inheritedSpid, exitSpid, emphSpid, flySpid, buildSpid }) {
  return `<p:timing>
  <p:tnLst>
    <p:par>
      <p:cTn id="1" dur="indefinite" nodeType="tmRoot">
        <p:childTnLst>
          <p:seq concurrent="ind" nextAc="seek">
            <p:cTn id="2" dur="indefinite" nodeType="mainSeq">
              <p:childTnLst>
                <p:par>
                  <p:cTn id="3" fill="hold">
                    <p:childTnLst>
                      <p:par>
                        <p:cTn id="4" fill="hold">
                          <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                          <p:childTnLst>
                            ${effectCtn({ id: 5, presetID: 10, presetClass: 'entr', nodeType: 'clickEffect', spid: clickSpid, dur: 800, filter: 'fade' })}
                            ${effectCtn({ id: 6, presetID: 10, presetClass: 'entr', nodeType: 'withEffect', spid: withSpid, dur: 800, filter: 'fade' })}
                          </p:childTnLst>
                        </p:cTn>
                      </p:par>
                    </p:childTnLst>
                  </p:cTn>
                </p:par>
                <p:par>
                  <p:cTn id="10" fill="hold">
                    <p:childTnLst>
                      ${effectCtn({ id: 11, presetID: 10, presetClass: 'entr', nodeType: 'afterEffect', spid: afterSpid, dur: 500, delay: 200 })}
                    </p:childTnLst>
                  </p:cTn>
                </p:par>
                <p:par>
                  <p:cTn id="20" nodeType="clickEffect" fill="hold">
                    <p:childTnLst>
                      ${effectCtn({ id: 21, presetID: 2, presetClass: 'entr', presetSubtype: 8, spid: inheritedSpid, dur: 1000, filter: 'wipe' })}
                    </p:childTnLst>
                  </p:cTn>
                </p:par>
                <p:par>
                  <p:cTn id="30" fill="hold">
                    <p:childTnLst>
                      ${effectCtn({ id: 31, presetID: 2, presetClass: 'entr', presetSubtype: 4, nodeType: 'clickEffect', spid: flySpid, dur: 1200, filter: 'wipe' })}
                      ${effectCtn({ id: 32, presetID: 10, presetClass: 'exit', nodeType: 'withEffect', spid: exitSpid, dur: 400, filter: 'fade' })}
                      ${effectCtn({ id: 33, presetID: 26, presetClass: 'emph', nodeType: 'afterEffect', spid: emphSpid, dur: 600 })}
                    </p:childTnLst>
                  </p:cTn>
                </p:par>
              </p:childTnLst>
            </p:cTn>
          </p:seq>
        </p:childTnLst>
      </p:cTn>
    </p:par>
  </p:tnLst>
  <p:bldLst>
    <p:bldP spid="${buildSpid}" grpId="0" animBg="1"/>
  </p:bldLst>
</p:timing>`
}

async function loadDeckWithTiming(name, buildTiming) {
  const zip = await JSZip.loadAsync(readFileSync(fixture(name)))
  const slidePath = Object.keys(zip.files).find(n => /^ppt\/slides\/slide1\.xml$/i.test(n))
  assert.ok(slidePath, 'slide1.xml present')
  let xml = await zip.file(slidePath).async('string')
  const ids = [...xml.matchAll(/cNvPr[^>]*\bid="(\d+)"/g)].map(m => m[1])
  assert.ok(ids.length >= 1, 'slide has cNvPr ids')
  const pick = (i) => ids[Math.min(i, ids.length - 1)]
  const targets = {
    clickSpid: pick(0),
    withSpid: pick(1),
    afterSpid: pick(2),
    inheritedSpid: pick(3),
    flySpid: pick(4),
    exitSpid: pick(5),
    emphSpid: pick(6),
    buildSpid: pick(0),
  }
  const block = buildTiming(targets)
  if (xml.includes('<p:timing')) xml = xml.replace(/<p:timing[\s\S]*<\/p:timing>/, block)
  else xml = xml.replace('</p:sld>', `${block}</p:sld>`)
  zip.file(slidePath, xml)
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  const json = await parse(buf.buffer, { imageMode: 'none' })
  return { json, targets }
}

test('parses deck structure', async () => {
  const json = await loadDeck('zlomky.pptx')

  assert.equal(json.slides.length, 4)
  assert.ok(Math.abs(json.size.width - 960) < 1)
  assert.equal(json.size.height, 540)
  assert.ok(Array.isArray(json.themeColors))
  assert.ok(json.slides.every(slide => Array.isArray(slide.elements) && slide.elements.length > 0))
  assert.ok(json.slides.every(slide => Array.isArray(slide.animations) && Array.isArray(slide.builds)))
})

test('discovers slides from presentation.xml.rels when Content_Types omits slide Overrides', async () => {
  const zip = await JSZip.loadAsync(readFileSync(fixture('zlomky.pptx')))
  const typesPath = Object.keys(zip.files).find(n => n.replace(/\\/g, '/') === '[Content_Types].xml')
  assert.ok(typesPath, '[Content_Types].xml present')
  let types = await zip.file(typesPath).async('string')
  types = types.replace(/<Override[^>]*presentationml\.slide\+xml[^>]*\/>/g, '')
  assert.equal(
    (types.match(/presentationml\.slide\+xml/g) || []).length,
    0,
    'fixture must have no slide Overrides after strip',
  )
  zip.file(typesPath, types)
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  const json = await parse(buf.buffer, { imageMode: 'none' })
  assert.equal(json.slides.length, 4)
  assert.ok(json.slides.every(slide => Array.isArray(slide.elements) && slide.elements.length > 0))
})

test('converts inline OMML math to LaTeX spans', async () => {
  const json = await loadDeck('zlomky.pptx')
  const contents = json.slides.flatMap(s => s.elements).map(el => el.content || '')

  const mathSpans = contents.flatMap(c => [...c.matchAll(/<span class="omml-math" data-latex="([^"]+)"(?: style="([^"]*)")?>/g)])
  assert.equal(mathSpans.length, 2)

  const latexes = mathSpans.map(m => m[1])
  assert.ok(latexes.includes('\\frac{2}{7}+\\frac{3}{7}=\\frac{5}{7}'))

  // Math spans must sit inside paragraph flow, not replace it
  const withMath = contents.filter(c => c.includes('omml-math'))
  assert.ok(withMath.every(c => c.includes('<p')))
})

test('math spans carry the deck font size and inherit sibling run color', async () => {
  const json = await loadDeck('zlomky.pptx')
  const contents = json.slides.flatMap(s => s.elements).map(el => el.content || '')

  const mathSpans = contents.flatMap(c => [...c.matchAll(/<span class="omml-math" data-latex="([^"]+)" style="([^"]*)">/g)])
  assert.equal(mathSpans.length, 2)

  // Every equation must carry an explicit font size so editors don't shrink
  // it to their default text size.
  for (const [, , style] of mathSpans) {
    assert.match(style, /font-size: \d+(\.\d+)?pt;/)
  }

  const byLatex = new Map(mathSpans.map(m => [m[1], m[2]]))

  // Math-only paragraph: size pinned by the math run itself.
  assert.match(byLatex.get('\\frac{2}{7}+\\frac{3}{7}=\\frac{5}{7}'), /font-size: 40pt;/)

  // Equation embedded in a line of text ("Nejznámější zlomek: …"): the math
  // run pins no color of its own, so it must inherit the sibling text run's
  // teal instead of falling back to the theme default black.
  const inline = byLatex.get('\\frac{1}{2}=0.5')
  assert.match(inline, /font-size: 54pt;/)
  assert.match(inline, /color: #0F766E;/)
})

test('line shapes keep geometry and structured border color', async () => {
  const json = await loadDeck('zlomky-lines.pptx')

  const collect = elements => elements.flatMap(el => el.type === 'group' ? collect(el.elements) : [el])
  const lines = json.slides.flatMap(s => collect(s.elements)).filter(el => el.shapType === 'line')

  assert.ok(lines.length >= 4, `expected line shapes, got ${lines.length}`)

  for (const line of lines) {
    // Consumers (PPTist) draw these from the border — the contract is a
    // structured color plus a resolvable stroke width and a path.
    assert.equal(typeof line.borderColor, 'object')
    assert.ok(['color', 'gradient'].includes(line.borderColor.type))
    if (line.borderColor.type === 'color') assert.match(line.borderColor.value, /^#[0-9A-Fa-f]{6}$|^transparent$/)
    assert.ok(line.borderWidth > 0)
    assert.ok(line.path && line.path.startsWith('M'))
  }

  // The fraction bars from the source deck: horizontal, zero-height, sky blue.
  const bars = lines.filter(l => l.borderColor.value === '#0EA5E9')
  assert.ok(bars.length >= 3)
  assert.ok(bars.every(l => l.height === 0 && l.width > 0))
})

test('keeps font faces from the source deck', async () => {
  const json = await loadDeck('zlomky.pptx')
  const contents = json.slides.flatMap(s => s.elements).map(el => el.content || '').join('')

  assert.ok(contents.includes('font-family: Lato'))
})

test('parses click / withPrevious / afterPrevious element animations from p:timing', async () => {
  const { json, targets } = await loadDeckWithTiming('zlomky.pptx', timingXml)
  const slide = json.slides[0]
  assert.ok(Array.isArray(slide.animations))
  assert.ok(Array.isArray(slide.builds))

  const bySpid = Object.fromEntries(slide.animations.map(a => [a.spid + ':' + a.class + ':' + a.trigger, a]))

  const click = slide.animations.find(a => a.spid === targets.clickSpid && a.trigger === 'onClick' && a.class === 'entr')
  assert.ok(click, 'click entrance on first shape')
  assert.equal(click.presetId, 10)
  assert.equal(click.duration, 800)
  assert.equal(click.filter, 'fade')

  const withPrev = slide.animations.find(a => a.spid === targets.withSpid && a.trigger === 'withPrevious')
  assert.ok(withPrev, 'withPrevious companion')

  const after = slide.animations.find(a => a.spid === targets.afterSpid && a.trigger === 'afterPrevious')
  assert.ok(after, 'afterPrevious effect')
  assert.equal(after.delay, 200)
  assert.equal(after.duration, 500)

  const inherited = slide.animations.find(a => a.spid === targets.inheritedSpid && a.presetId === 2)
  assert.ok(inherited, 'presetClass child inherits ancestor clickEffect')
  assert.equal(inherited.trigger, 'onClick')
  assert.equal(inherited.presetSubtype, 8)

  const fly = slide.animations.find(a => a.spid === targets.flySpid && a.presetId === 2 && a.presetSubtype === 4)
  assert.ok(fly, 'fly-in from bottom')
  assert.equal(fly.trigger, 'onClick')

  const exit = slide.animations.find(a => a.spid === targets.exitSpid && a.class === 'exit')
  assert.ok(exit, 'exit effect')
  assert.equal(exit.trigger, 'withPrevious')

  const emph = slide.animations.find(a => a.spid === targets.emphSpid && a.class === 'emph')
  assert.ok(emph, 'emphasis effect')
  assert.equal(emph.trigger, 'afterPrevious')
  assert.equal(emph.presetId, 26)

  assert.equal(slide.builds.length, 1)
  assert.equal(slide.builds[0].spid, targets.buildSpid)
  assert.equal(slide.builds[0].type, 'paragraph')
  assert.equal(slide.builds[0].animBg, true)

  const clickIndex = slide.animations.indexOf(click)
  const withIndex = slide.animations.indexOf(withPrev)
  const afterIndex = slide.animations.indexOf(after)
  assert.ok(clickIndex < withIndex && withIndex < afterIndex, 'document order is presenter sequence')
  assert.ok(bySpid)
})
