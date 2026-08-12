import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from '../dist/index.js'

const fixture = path => fileURLToPath(new URL(`./fixtures/${path}`, import.meta.url))

const loadDeck = async name => {
  const buffer = readFileSync(fixture(name))
  return await parse(buffer.buffer, { imageMode: 'none' })
}

test('parses deck structure', async () => {
  const json = await loadDeck('zlomky.pptx')

  assert.equal(json.slides.length, 4)
  assert.ok(Math.abs(json.size.width - 960) < 1)
  assert.equal(json.size.height, 540)
  assert.ok(Array.isArray(json.themeColors))
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

test('keeps font faces from the source deck', async () => {
  const json = await loadDeck('zlomky.pptx')
  const contents = json.slides.flatMap(s => s.elements).map(el => el.content || '').join('')

  assert.ok(contents.includes('font-family: Lato'))
})
