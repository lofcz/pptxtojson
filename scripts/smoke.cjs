const fs = require('fs')
const { parse } = require('./dist/index.cjs')

async function main() {
  const file = process.argv[2]
  const buffer = fs.readFileSync(file)
  const json = await parse(buffer.buffer, { imageMode: 'none' })

  console.log('slides:', json.slides.length, 'size:', JSON.stringify(json.size))

  let mathSpans = 0
  let fonts = new Set()
  for (const slide of json.slides) {
    for (const el of slide.elements) {
      const content = el.content || ''
      mathSpans += (content.match(/class="omml-math"/g) || []).length
      for (const m of content.matchAll(/font-family: ([^;"]+)/g)) fonts.add(m[1].trim())
    }
  }
  console.log('omml-math spans:', mathSpans)
  console.log('fonts:', [...fonts].join(', '))

  const firstMath = json.slides.flatMap(s => s.elements)
    .map(el => (el.content || '').match(/data-latex="([^"]+)"/))
    .find(Boolean)
  console.log('first latex:', firstMath ? firstMath[1] : '(none)')
}

main().catch(e => { console.error('FAILED:', e); process.exit(1) })
