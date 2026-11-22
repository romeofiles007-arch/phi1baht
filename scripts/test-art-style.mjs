// เทสต์: ลายเส้นภาพของผี 1 บาท — การ์ตูนเล่มละบาทแบบลงสี (lemlabaht) ลายเส้นเดียว · ปกแบบปกเล่มละบาท
//   node --test scripts/test-art-style.mjs
// spec 5.4: เส้นหมึกแบบหน้าในของเล่มจริง + ลงสีไม้/สีน้ำแบบปกเล่มจริง · ทุกภาพเป็นภาพสี · ฉากเต็มเฟรม ไม่มีกรอบช่อง
//   ภาพในเรื่องไม่มีตัวหนังสือ (ซับมาจาก ffmpeg) · ปกเป็นภาพเดียวที่มีตัวหนังสือ (โลโก้ "ผี 1 บาท" ของเราเอง)
// เคยเป็น (แอปต้นแบบ): doodle / หมึกจีนกงปี่ / สุ่ม + กฎโทนเย็นห้ามเหลือง + paper-tone ลบกระดาษเหลือง — ตรงข้ามกับแอปนี้
// ผู้ใช้ตัดสิน 22 พ.ย.: ภาพต้องไม่ออกเหลือง เอาสีสดใส — สีสด กระดาษขาวสะอาด ขาวต้องขาว ห้ามโทนกระดาษเก่า/ซีเปีย/ฟิลเตอร์เหลืองทั้งภาพ
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as shared from '../extension/prompts.js'
import { ROOT } from '../pipeline/lib/config.mjs'
import { readProfile } from '../pipeline/lib/clip_profile.mjs'
import { flowPrompt } from '../pipeline/lib/prompts.mjs'
import { coverBriefLines, coverRequest } from '../pipeline/lib/cover.mjs'
import { bodyStyleRule, bodyStyleFlowNote } from '../pipeline/lib/character.mjs'

const { ART_STYLES, RETIRED_ART_STYLES, FULL_BLEED_RULE, VIVID_COLOR_RULE, VIVID_COLOR_RULE_EN, categoryColorRule, categoryRule } = shared
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** สร้างคลิปชั่วคราวที่มี profile.json แล้วลบทิ้งหลังใช้ */
function withClip(profile, fn) {
  const slug = `_test_art_style_${process.pid}_${Math.random().toString(36).slice(2, 8)}`
  const dir = join(ROOT, 'projects', slug, '00_ref')
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'profile.json'), JSON.stringify(profile))
    return fn(slug)
  } finally {
    rmSync(join(ROOT, 'projects', slug), { recursive: true, force: true })
  }
}

test('ลายเส้นเดียว: lemlabaht (ไม่มีตัวเลือกอื่น ไม่มีสุ่ม)', () => {
  assert.deepEqual(Object.keys(ART_STYLES), ['lemlabaht'])
  for (const key of ['label', 'rule', 'flow', 'body', 'bodyFlow']) assert.ok(ART_STYLES.lemlabaht[key], key)
})

test('คำสั่ง Flow ของ lemlabaht: เส้นหมึก + ลงสี · ไม่ใช่อนิเมะ · ไม่มีกรอบช่อง · ไม่พูดถึงขาวดำเลย', () => {
  const { flow, rule } = ART_STYLES.lemlabaht
  assert.match(flow, /ลงสี/)
  assert.match(flow, /เส้นหมึก/)
  assert.match(flow, /ไม่ใช่อนิเมะ/)
  assert.match(flow, /ไม่มีกรอบช่อง/)
  // ทุกภาพเป็นภาพสี — ไม่เอ่ยคำว่าขาวดำในคำบรรยายลายเส้นเลย (กันโมเดลหยิบคำไปใช้)
  for (const text of [flow, rule]) assert.ok(!/ขาวดำ|ขาว-ดำ|monochrome|black and white/i.test(text), text)
  // ลงสีไม้/สีน้ำแบบปก เห็นเนื้อกระดาษ · ฉากไทย · สัดส่วนสมจริงยุค 2520
  assert.match(flow, /สีไม้|สีน้ำ/)
  assert.match(flow, /เนื้อกระดาษ/)
  assert.match(flow, /2520/)
  assert.match(flow, /เรือนไทย/)
  // กฎของ ChatGPT ใช้ร่วมกับกฎหมวด → ห้ามมีคำที่ชวนวาดช่องการ์ตูน (เทสต์หมวดตรวจ /ช่องการ์ตูน|กรอบช่อง|เลขหน้า|panel/)
  assert.ok(rule.includes(FULL_BLEED_RULE))
  assert.ok(!/ช่องการ์ตูน|กรอบช่อง|เลขหน้า|panel/i.test(rule))
  assert.match(rule, /FULLY COLORED/)
})

test('คลิปเก่าที่เป็นลายเส้นเลิกใช้ (doodle/inkwash/random/chinese/watercolor) อ่านเป็น lemlabaht', () => {
  assert.deepEqual(RETIRED_ART_STYLES, { doodle: 'lemlabaht', inkwash: 'lemlabaht', random: 'lemlabaht', chinese: 'lemlabaht', watercolor: 'lemlabaht' })
  for (const old of Object.keys(RETIRED_ART_STYLES)) {
    withClip({ category: 'ghost', artStyle: old }, (slug) => {
      assert.equal(readProfile(slug).artStyle, 'lemlabaht', old)
      const prompt = flowPrompt('BRIEF', {}, slug)
      assert.ok(prompt.includes(ART_STYLES.lemlabaht.flow), old)
      assert.ok(prompt.includes(FULL_BLEED_RULE), old)
    })
  }
})

test('ไม่รู้คลิป/ไม่มีลายเส้นในโปรไฟล์ ก็ได้ lemlabaht (ไม่ตกไปเป็น doodle)', () => {
  assert.ok(flowPrompt('BRIEF', {}, null).includes(ART_STYLES.lemlabaht.flow))
  assert.equal(bodyStyleRule(null, null), ART_STYLES.lemlabaht.body)
  assert.equal(bodyStyleFlowNote(null, null), ART_STYLES.lemlabaht.bodyFlow)
  assert.ok(!/doodle หัวกลมโต|SIMPLE MODE/.test(bodyStyleRule(null, null)))
  const rule = categoryRule({ category: 'ghost', scare: 'medium' }, 'image')
  assert.ok(rule.includes(ART_STYLES.lemlabaht.rule))
  assert.ok(rule.includes(categoryColorRule('ghost')))
})

test('(Review Focus 2) ช็อตในเรื่องห้ามมีตัวหนังสือ · ปกมีโลโก้ "ผี 1 บาท" ป้าย "1 บาท" แถบลายเฉียง และไม่มีกฎห้ามตัวหนังสือ', () => {
  const prompt = flowPrompt('00_00_00.png SHOT 01 | Chars: @main | Env: เรือนไทย', {}, null)
  assert.match(prompt, /ห้ามมีตัวหนังสือ|no text/i)
  // เลิกกฎเดิม "ตัวอักษรในภาพมีได้เฉพาะข้อความที่ shot สั่งไว้" (เปิดช่องให้ช็อตในเรื่องมีตัวหนังสือ)
  assert.ok(!/มีได้เฉพาะข้อความที่ shot สั่งไว้/.test(prompt))

  const shot = { filename: 'cover.png', shot: 'COVER', prompt: 'COVER | Chars: @main | Env: ต้นตะเคียน', language: 'th', title: 'กระสือเคาะประตู', category: 'ghost' }
  const cover = coverBriefLines(shot, true).join('\n')
  assert.match(cover, /ผี 1 บาท/)
  assert.match(cover, /1 บาท/)
  assert.match(cover, /แถบลายเฉียง/)
  assert.ok(!/ห้ามมีตัวหนังสือ|ไม่มีตัวหนังสือ|ไม่มีตัวอักษร|no text/i.test(cover), cover)
  // โลโก้ของเราเอง — ห้ามเลียนโลโก้ "N" ของสำนักพิมพ์จริง
  assert.match(cover, /ห้ามเลียน[^·]*"N"/)
  assert.match(cover, /ครึ่งตัว/)
  assert.match(cover, /ลงสี/)
  // ไม่เหลือสูตรปก YouTube ของแอปต้นแบบ
  assert.ok(!/YouTube|บุคคลในประวัติศาสตร์|ลูกศร/.test(cover))

  const request = coverRequest(true, 'th')
  for (const re of [/ผี 1 บาท/, /แถบลายเฉียง/, /"1 บาท"/, /ห้ามเลียน[^·]*"N"/]) assert.match(request, re)
  assert.ok(!/ห้ามมีตัวหนังสือ|ไม่มีตัวหนังสือ|no text/i.test(request))
})

test('ชุดสีตามหมวด: ผีโทนมืดแดงเลือด · ตลกโทนสว่างเหลือง · ทุกหมวดมีกฎสีสด/ขาวสะอาด/ห้ามเหลืองคลุมทั้งภาพ', () => {
  assert.match(categoryColorRule('ghost'), /แดงเลือด/)
  assert.match(categoryColorRule('comedy'), /เหลือง/) // เหลืองเป็นสีหนึ่งในภาพได้
  // ทุกหมวดได้ชุดสีของตัวเอง (hex จาก CATEGORIES.palette) · ไม่รู้หมวด = ชุดสีปกเล่มละบาททั่วไป ไม่ throw
  for (const c of shared.CATEGORIES) {
    const rule = categoryColorRule(c.id)
    assert.ok(rule.includes(c.palette[0]), c.id)
    assert.ok(rule.includes(VIVID_COLOR_RULE), c.id)
    assert.ok(!/ขาวดำ/.test(rule), c.id)
  }
  assert.match(categoryColorRule('nope'), /เหลือง/)
  assert.ok(categoryColorRule('nope').includes(VIVID_COLOR_RULE))
  // flowPrompt ใช้ชุดสีของหมวดคลิป · ไม่มีกฎโทนเย็นของแอปต้นแบบ
  withClip({ category: 'ghost', artStyle: 'lemlabaht' }, (slug) => {
    const prompt = flowPrompt('BRIEF', {}, slug)
    assert.ok(prompt.includes(categoryColorRule('ghost')))
    assert.ok(!/เย็นสบายตา/.test(prompt), prompt)
  })
  assert.equal('COLOR_MOOD_RULE' in shared, false)
})

// ── ผู้ใช้ตัดสิน 22 พ.ย.: "อย่าให้ภาพออกเหลืองเอาสีสดใส" (spec 5.4) ──
// คำที่ชวนให้วาดบนกระดาษเหลือง/เก่า — ห้ามอยู่ในข้อความภาพทุกที่ ยกเว้นในประโยคห้ามของ VIVID_COLOR_RULE_EN เอง
const YELLOW_PAPER = /aged[- ]paper|yellowed|sepia|กระดาษเหลือง|กระดาษปรู๊ฟ|เหลืองนวล|เหลืองหม่น/i
const outsideRule = (text) => text.split(VIVID_COLOR_RULE_EN).join(' ')

test('กฎสีสด: ภาษาไทยและอังกฤษ บอกสิ่งที่อยากได้ (สีสด กระดาษขาวสะอาด ขาวเป็นกลาง) และห้ามเหลือง/ซีเปียคลุมทั้งภาพ แต่เหลืองเป็นสีของสิ่งของได้', () => {
  assert.match(VIVID_COLOR_RULE, /สีสด/)
  assert.match(VIVID_COLOR_RULE, /กระดาษขาวสะอาด/)
  assert.match(VIVID_COLOR_RULE, /ขาวต้องขาว/)
  assert.match(VIVID_COLOR_RULE, /neutral white balance/)
  assert.match(VIVID_COLOR_RULE, /ห้าม[^·]*ซีเปีย/)
  assert.match(VIVID_COLOR_RULE, /ห้าม[^·]*เหลือง[^·]*คลุมทั้งภาพ/)
  assert.match(VIVID_COLOR_RULE, /เสื้อเหลือง|ท้องฟ้า/) // เหลืองเป็นสีของสิ่งของ/ท้องฟ้าได้
  assert.ok(!YELLOW_PAPER.test(VIVID_COLOR_RULE), VIVID_COLOR_RULE)

  assert.match(VIVID_COLOR_RULE_EN, /bright, vivid, saturated/)
  assert.match(VIVID_COLOR_RULE_EN, /clean white paper/)
  assert.match(VIVID_COLOR_RULE_EN, /crisp whites/)
  assert.match(VIVID_COLOR_RULE_EN, /neutral white balance/)
  assert.match(VIVID_COLOR_RULE_EN, /no overall yellow[^;]*sepia/i)
  assert.match(VIVID_COLOR_RULE_EN, /vintage warm filter/)
  assert.match(VIVID_COLOR_RULE_EN, /yellow is fine as the color of an object/)
})

test('ข้อความภาพทุกที่ (ลายเส้น · ชุดสีทุกหมวด · ปก · Blueprint) ไม่สั่งกระดาษเหลือง/ซีเปีย และมีกฎสีสด', () => {
  const s = ART_STYLES.lemlabaht
  const texts = {
    'lemlabaht.rule': s.rule,
    'lemlabaht.flow': s.flow,
    'lemlabaht.body': s.body,
    'lemlabaht.bodyFlow': s.bodyFlow,
    'categoryColorRule(nope)': categoryColorRule('nope'),
    ...Object.fromEntries(shared.CATEGORIES.map((c) => [`categoryColorRule(${c.id})`, categoryColorRule(c.id)])),
    ...Object.fromEntries(['ghost', 'folk', null].map((category) => [`coverBriefLines(${category})`, coverBriefLines({ filename: 'cover.png', prompt: 'COVER | Chars: @main', title: 'ท', language: 'th', category }, true).join('\n')])),
    'coverRequest': coverRequest(true, 'th', 'comedy'),
    'VDO Concept.txt': read('extension/VDO Concept.txt'),
  }
  for (const [name, text] of Object.entries(texts)) {
    const m = YELLOW_PAPER.exec(outsideRule(text))
    assert.equal(m, null, `${name}: "${m?.[0]}"`)
  }
  // บอกสิ่งที่อยากได้ + ข้อห้ามเหลืองคลุมทั้งภาพ: ไทยไปที่ Flow/ChatGPT ขั้นภาพ · อังกฤษไปที่ Style Bible
  for (const name of ['lemlabaht.flow', 'categoryColorRule(nope)', ...shared.CATEGORIES.map((c) => `categoryColorRule(${c.id})`), 'coverBriefLines(ghost)', 'coverBriefLines(folk)', 'coverBriefLines(null)', 'coverRequest']) {
    assert.ok(texts[name].includes(VIVID_COLOR_RULE), name)
  }
  assert.ok(s.rule.includes(VIVID_COLOR_RULE_EN), 'rule: Style Bible ART STYLE (อังกฤษ)')
  assert.ok(s.rule.includes(VIVID_COLOR_RULE), 'rule: บรรทัดลงสี (ไทย)')
  const colorLine = texts['VDO Concept.txt'].split(/\r?\n/).find((l) => /^- Color:/.test(l))
  assert.ok(colorLine.includes(VIVID_COLOR_RULE_EN), colorLine)
  // ไม่มีเฉดอุ่นของกระดาษในคำบรรยายอารมณ์สี
  assert.ok(!/warm paper|paper cream|warm yellowish/i.test(texts['VDO Concept.txt']))
  assert.ok(!/กระดาษครีม|เหลืองเก่า|เหลืองอุ่น/.test(Object.values(texts).join('\n')))
})

test('ชุดสีหมวด (inkify ดึงสีเข้าหา): ไม่มีสีกระดาษเก่า/ครีม · ทุกหมวดมีขาวกลาง · ผี/ไสยยังโทนมืดสด', () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  for (const c of shared.CATEGORIES) {
    for (const h of c.palette) {
      const [r, g, b] = rgb(h)
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      // ครีม/เหลืองซีด/กระดาษเก่า = สว่าง สีอ่อน ฮิวเหลือง (30–75°) → ดึงส่วนขาวให้เหลือง
      const hue = max === min ? 0 : max === r ? (((g - b) / (max - min)) * 60 + 360) % 360 : max === g ? ((b - r) / (max - min) + 2) * 60 : ((r - g) / (max - min) + 4) * 60
      const creamy = max > 120 && (max - min) / max < 0.5 && hue >= 30 && hue <= 75
      assert.ok(!creamy, `${c.id} ${h} เป็นสีกระดาษเก่า/ครีม`)
    }
    assert.ok(c.palette.some((h) => { const v = rgb(h); return Math.min(...v) >= 240 && Math.max(...v) - Math.min(...v) <= 8 }), `${c.id} ต้องมีขาวกลาง`)
  }
  for (const id of ['ghost', 'saiyasat']) {
    const p = shared.CATEGORIES.find((c) => c.id === id).palette
    assert.ok(p.some((h) => { const [r, g, b] = rgb(h); return r > 150 && g < 60 && b < 70 }), `${id} แดงเลือดสด`)
  }
  const blueprint = read('extension/VDO Concept.txt')
  for (const c of shared.CATEGORIES) for (const h of c.palette) assert.ok(blueprint.toLowerCase().includes(h.toLowerCase()), `Blueprint COLOR PALETTE ขาด ${c.id} ${h}`)
})

test('(M4) ไม่มีกฎโทนเย็นของแอปต้นแบบหลงเหลือ · Style Bible ใน Blueprint ตรงกับ lemlabaht', () => {
  for (const file of ['extension/prompts.js', 'pipeline/lib/prompts.mjs', 'pipeline/lib/shotlist.mjs', 'pipeline/lib/cover.mjs', 'pipeline/lib/character.mjs']) {
    const src = read(file)
    assert.ok(!/เย็นสบายตา|ห้ามแสงทอง|ห้ามบรรยายฉากเป็นแสงทอง|gongbi|กงปี่/i.test(src), file)
  }
  const blueprint = read('extension/VDO Concept.txt')
  const colorLine = blueprint.split(/\r?\n/).find((l) => /^- Color:/.test(l))
  assert.ok(colorLine, 'ART STYLE ต้องมีบรรทัด Color')
  assert.match(colorLine, /colored pencil \/ watercolor/)
  assert.match(colorLine, /category/)
  assert.match(colorLine, /clean white paper/)
  assert.ok(!/cool tones/i.test(blueprint))
  assert.match(blueprint, /COLOR PALETTE \(per category/)
  assert.match(blueprint, /Style Kit/)
})

test('Style Kit ที่แนบให้ Flow ใช้เป็นแบบเทคนิคเส้น/การลงสีเท่านั้น ไม่ใช่โทนสีกระดาษ', () => {
  const src = read('pipeline/lib/prompts.mjs')
  const note = /export function styleKitFlowNote[\s\S]*?\n}/.exec(src)[0]
  assert.ok(!/การลงสี และเนื้อกระดาษ/.test(note), 'ห้ามบอกให้เลียนเนื้อ/สีกระดาษของ kit')
  assert.match(note, /ห้ามเลียนโทนสี/)
})

test('paper-tone เดิม (แอปต้นแบบ) ไม่กลับมาเป็นขั้นแยก — ตัวปรับขาวให้เป็นกลางอยู่ใน inkify (paperGains) ก่อนแปลงเป็นงานพิมพ์', () => {
  assert.equal(existsSync(new URL('../pipeline/lib/paper-tone.mjs', import.meta.url)), false)
  assert.equal(existsSync(new URL('../scripts/test-paper-tone.mjs', import.meta.url)), false)
  const src = read('pipeline/5_images.mjs')
  assert.ok(!/neutralizePaper|paper-tone/.test(src))
  assert.match(read('pipeline/lib/inkify.mjs'), /export function paperGains/)
})

test('แผงข้าง/bridge ไม่มีตัวเลือกลายเส้นแล้ว (ลายเส้นเดียว)', () => {
  const html = read('extension/sidepanel.html')
  assert.ok(!/id="clipArtStyle"|id="prodRandArt"|id="clipArtOverride"/.test(html))
  const js = read('extension/sidepanel.js')
  assert.ok(!/clipArtStyle|prodRandArt|clipArtOverride/.test(js))
  const ui = read('bridge/ui.js')
  assert.ok(!/body\.artStyle|options[^\n]*artStyle|artStyle: Object\.entries/.test(ui))
})
