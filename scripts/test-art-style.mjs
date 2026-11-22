// เทสต์: ลายเส้นภาพของผี 1 บาท — การ์ตูนเล่มละบาทแบบลงสี (lemlabaht) ลายเส้นเดียว · ปกแบบปกเล่มละบาท
//   node --test scripts/test-art-style.mjs
// spec 5.4: เส้นหมึกแบบหน้าในของเล่มจริง + ลงสีไม้/สีน้ำแบบปกเล่มจริง · ทุกภาพเป็นภาพสี · ฉากเต็มเฟรม ไม่มีกรอบช่อง
//   ภาพในเรื่องไม่มีตัวหนังสือ (ซับมาจาก ffmpeg) · ปกเป็นภาพเดียวที่มีตัวหนังสือ (โลโก้ "ผี 1 บาท" ของเราเอง)
// เคยเป็น (แอปต้นแบบ): doodle / หมึกจีนกงปี่ / สุ่ม + กฎโทนเย็นห้ามเหลือง + paper-tone ลบกระดาษเหลือง — ตรงข้ามกับแอปนี้
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

const { ART_STYLES, RETIRED_ART_STYLES, FULL_BLEED_RULE, categoryColorRule, categoryRule } = shared
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

test('ชุดสีตามหมวด: ผีโทนมืดแดงเลือด · ตลกโทนสว่างเหลือง · ไม่มีกฎห้ามเหลือง/ซีเปียหลงเหลือ', () => {
  assert.match(categoryColorRule('ghost'), /แดงเลือด/)
  assert.match(categoryColorRule('comedy'), /เหลือง/)
  for (const id of ['ghost', 'comedy']) assert.ok(!/ห้าม.*เหลือง|sepia/.test(categoryColorRule(id)), id)
  // ทุกหมวดได้ชุดสีของตัวเอง (hex จาก CATEGORIES.palette) · ไม่รู้หมวด = ชุดสีปกเล่มละบาททั่วไป ไม่ throw
  for (const c of shared.CATEGORIES) {
    const rule = categoryColorRule(c.id)
    assert.ok(rule.includes(c.palette[0]), c.id)
    assert.ok(!/ห้าม.*เหลือง|sepia|ขาวดำ/.test(rule), c.id)
  }
  assert.match(categoryColorRule('nope'), /เหลือง/)
  // flowPrompt ใช้ชุดสีของหมวดคลิป แทนกฎโทนเย็นเดิม
  withClip({ category: 'ghost', artStyle: 'lemlabaht' }, (slug) => {
    const prompt = flowPrompt('BRIEF', {}, slug)
    assert.ok(prompt.includes(categoryColorRule('ghost')))
    assert.ok(!/เย็นสบายตา|ห้าม[^\n]*ซีเปีย|ห้ามทั้งภาพออกโทนเหลือง/.test(prompt), prompt)
  })
  assert.equal('COLOR_MOOD_RULE' in shared, false)
})

test('(M4) ไม่มีกฎโทนเย็น/ห้ามเหลือง/ห้ามกระดาษเก่า หลงเหลือ · Style Bible ใน Blueprint ตรงกับ lemlabaht', () => {
  for (const file of ['extension/prompts.js', 'pipeline/lib/prompts.mjs', 'pipeline/lib/shotlist.mjs', 'pipeline/lib/cover.mjs', 'pipeline/lib/character.mjs']) {
    const src = read(file)
    assert.ok(!/เย็นสบายตา|ห้ามแสงทอง|ห้ามบรรยายฉากเป็นแสงทอง|ไม่ใช่โทนเหลือง|ห้ามทั้งภาพออกโทนเหลือง|no aged or yellowed paper|no sepia|ไม่กระดาษเก่า|gongbi|กงปี่/i.test(src), file)
  }
  const blueprint = read('extension/VDO Concept.txt')
  const colorLine = blueprint.split(/\r?\n/).find((l) => /^- Color:/.test(l))
  assert.ok(colorLine, 'ART STYLE ต้องมีบรรทัด Color')
  assert.match(colorLine, /colored pencil \/ watercolor/)
  assert.match(colorLine, /category/)
  assert.match(colorLine, /paper/)
  assert.ok(!/cool tones|no yellow|no sepia|no aged paper/i.test(blueprint))
  assert.match(blueprint, /COLOR PALETTE \(per category/)
  assert.match(blueprint, /Style Kit/)
})

test('ลบ paper-tone (ลบกระดาษเหลือง) ทิ้ง — แอปนี้ต้องการกระดาษเหลืองนวล', () => {
  assert.equal(existsSync(new URL('../pipeline/lib/paper-tone.mjs', import.meta.url)), false)
  assert.equal(existsSync(new URL('../scripts/test-paper-tone.mjs', import.meta.url)), false)
  const src = read('pipeline/5_images.mjs')
  assert.ok(!/neutralizePaper|paper-tone/.test(src))
})

test('แผงข้าง/bridge ไม่มีตัวเลือกลายเส้นแล้ว (ลายเส้นเดียว)', () => {
  const html = read('extension/sidepanel.html')
  assert.ok(!/id="clipArtStyle"|id="prodRandArt"|id="clipArtOverride"/.test(html))
  const js = read('extension/sidepanel.js')
  assert.ok(!/clipArtStyle|prodRandArt|clipArtOverride/.test(js))
  const ui = read('bridge/ui.js')
  assert.ok(!/body\.artStyle|options[^\n]*artStyle|artStyle: Object\.entries/.test(ui))
})
