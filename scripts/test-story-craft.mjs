// บทต้องมีแก่นและมีจังหวะให้ติดตาม — มีปม เดิมพัน อุปสรรค เหตุประหลาด จุดพลิก · ตัวเอกมีชื่อ ไม่ใช่ "คุณ"
//   node --test scripts/test-story-craft.mjs
// บทเรียนจากแอปต้นแบบ (21 พ.ย. 2026): "คอนเทนต์สาระน้อยเกินไป ไม่มีแก่นสาร ไม่มีจังหวะที่ให้ติดตาม"
// Task 4: หมวดเปลี่ยนเป็น 5 หมวดเล่มละบาท · แนว "เพิ่มความสุข" เปลี่ยนเป็นระดับความสยอง · บทตัวอย่างเปลี่ยนเป็นเรื่องผีไทย
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scriptPrompt, STORY_CRAFT, endsGeneric, tellsAsYou, scareRule, reviseLengthPrompt, CATEGORIES } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const BLUEPRINT = read('extension/VDO Concept.txt')

for (const c of CATEGORIES) {
  test(`คำสั่งเขียนบท (${c.id}): มีหัวใจของบท ทุกระดับความสยอง`, () => {
    for (const scare of ['light', 'medium', 'strong']) {
      const prompt = scriptPrompt(BLUEPRINT, 'คืนที่นางตะเคียนร้องไห้', { language: 'th', targetMinutes: 1, profile: { category: c.id, scare }, engage: false })
      assert.ok(prompt.includes(STORY_CRAFT), 'ต้องมีหัวใจของบท')
      assert.ok(!prompt.includes('บุรุษที่ 2 ตลอด'), 'ห้ามสั่งให้เล่าบุรุษที่ 2 ทั้งเรื่อง')
    }
  })
}

test('หัวใจของบท: ปม เดิมพัน อุปสรรค ฉากเด็ด จุดพลิก โครง 1 นาที ประโยคปิดผูกกับเรื่อง', () => {
  for (const re of [/ปมภายใน 3 บรรทัดแรก/, /เดิมพัน/, /อุปสรรคหนักขึ้น/, /ฉากเด็ด/, /จุดพลิก/, /ทิ้งคำถามค้าง/, /เหตุประหลาด → เผชิญหน้า → หักมุมหรือผลกรรม → ประโยคปิด/, /ประโยคปิดต้องผูกกับเรื่องนี้/]) assert.match(STORY_CRAFT, re)
  // ระดับเบาก็ยังต้องมีผลกรรม (ไม่ใช่เรื่องที่ไม่มีอะไรเกิดขึ้น)
  assert.match(scareRule('light', 'ghost'), /ผลกรรม/)
})

test('ปรับความยาว: ไม่ยืดด้วยคำสอนหรือชีวิตคนยุคนี้ · ยังจบในคลิป', () => {
  const longer = reviseLengthPrompt('th', { minutes: 0.5, target: 1, pace: 'calm' })
  assert.ok(!/ตัวอย่างในชีวิตจริง|วิธีปฏิบัติ/.test(longer))
  assert.match(longer, /อุปสรรคอีกขั้น/)
  assert.match(longer, /จบในคลิปเดียว/)
  const shorter = reviseLengthPrompt('th', { minutes: 1.6, target: 1, pace: 'calm' })
  assert.match(shorter, /ประโยคปิดไว้/)
})

// 23 พ.ย. 2026: คำสั่งปรับความยาวไปตกแท็บ ChatGPT ใหม่ (ส่วนขยายรีโหลดกลางงาน) ChatGPT ไม่เห็นบทเดิม
// ตอบกลับ "กรุณาส่งบทพากย์ต้นฉบับมาได้เลยครับ" (140 ตัวอักษร) → บทสั้นผิดปกติ คลิปล้ม
test('ปรับความยาว: แนบบทเดิมไปด้วย ไม่พึ่งประวัติแชต', () => {
  const script = 'กลางดึก... เสียงเล็บขูดดังจากใต้ถุนเรือน\nทิดมั่นสะดุ้งตื่น'
  const p = reviseLengthPrompt('th', { minutes: 1.6, target: 1, pace: 'calm', script })
  assert.ok(p.includes(script), 'ต้องมีบทเดิมทั้งบทอยู่ในคำสั่ง')
  assert.match(p, /บทเดิม/)
  // ไม่ส่งบท (เรียกแบบเดิม) ก็ยังใช้ได้
  assert.doesNotMatch(reviseLengthPrompt('th', { minutes: 1.6, target: 1 }), /=== บทเดิม ===/)
})

const YOU_STORY = `คืนนั้น... คุณเดินเข้าบ้านร้างท้ายหมู่บ้าน
คุณได้ยินเสียงเรียกชื่อมาจากใต้ถุน
คุณหันไปมอง แต่ไม่มีใครอยู่ตรงนั้น
ลมเย็นพัดผ่านต้นไผ่
คุณก้าวขึ้นบันไดทีละขั้น
ก่อนจะเห็นเงาผมยาวในกระจก
เธอยิ้มให้คุณ
ประตูปิดเอง
และไม่มีใครเห็นคุณอีกเลย`

const NAMED_STORY = `ตีสองคืนเดือนมืด... ไฟตะเกียงบนเรือนยายเผื่อนดับเอง
ไอ้คงแอบขุดโคนต้นตะเคียนมาตั้งแต่หัวค่ำ
ทั้งที่ทั้งหมู่บ้านรู้... ว่าโอ่งทองใต้ต้นนั้นมีเจ้าของ
ถ้าเป็นคุณ จะกล้าขุดไหม?
คุณยายเผื่อนเคยเตือนเขาไว้แล้ว ว่าบุญคุณของเจ้าที่ห้ามลืม
พอฝาโอ่งเปิดออก... ข้างในไม่มีทองสักเม็ด
มีแต่ผมยาวสีดำ ม้วนเป็นขด
ทองที่ขุดจากใต้ต้นตะเคียน... ไม่เคยเป็นของคนเป็น
ถ้าเป็นคุณ จะขุดโอ่งใบนั้นไหม?
เล่าให้ฟังในคอมเมนต์หน่อย`

test('จับบทที่ให้ "คุณ" เป็นตัวละคร', () => {
  assert.equal(tellsAsYou(YOU_STORY), true)
  // ถามคนดู 1 ครั้งกลางเรื่อง + "คุณยาย" + "บุญคุณ" + ประโยคชวนคุยท้ายบท ไม่นับ
  assert.equal(tellsAsYou(NAMED_STORY), false)
  assert.equal(tellsAsYou('You walk into the house.\nYou hear a voice.\nYou turn.\nYou run.\nThe end.\nOne.\nTwo.'), true)
  // "คุณไสย" เป็นชื่อสิ่งของในหมวดไสยศาสตร์ ไม่ใช่การเรียกคนดู
  assert.equal(tellsAsYou('หมอผีรู้ทันทีว่าเป็นคุณไสย\nคุณไสยชนิดนี้ต้องแก้ก่อนเที่ยงคืน\nเขาจุดเทียนคาถา\nคุณไสยเริ่มคลาย\nบ้านเงียบลง\nหนึ่ง\nสอง'), false)
})

test('จับประโยคปิดลอยๆ ที่ใช้กับเรื่องไหนก็ได้ · ประโยคปิดสอนใจแบบเล่มละบาทไม่นับ', () => {
  assert.equal(endsGeneric('ไอ้คงหายไปจากหมู่บ้าน\nบางครั้ง... ความโลภก็น่ากลัวกว่าผี'), true)
  assert.equal(endsGeneric('ป่าช้าเงียบลง\nสุดท้ายแล้ว... ทุกคนก็ต้องตาย\nถ้าเป็นคุณ จะเดินผ่านป่าช้าไหม?'), true)
  assert.equal(endsGeneric(NAMED_STORY), false)
  assert.equal(endsGeneric('ผีนางตะเคียนหายไปพร้อมรุ่งเช้า\nทำกรรมใดไว้ ย่อมได้รับผลนั้น'), false)
  // "บางครั้ง" กลางเรื่องไม่นับ
  assert.equal(endsGeneric('บางครั้งยายก็ได้ยินเสียงเคาะใต้ถุน\nคืนนั้นเสียงดังกว่าทุกคืน\nยายเปิดหน้าต่าง\nแล้วไม่มีใครเห็นยายอีกเลย'), false)
})

test('autopilot ขอเขียนใหม่เมื่อตัวเอกเป็น "คุณ" หรือปิดลอยๆ (รอบสุดท้ายยอมรับ)', () => {
  const src = read('pipeline/autopilot.mjs')
  assert.match(src, /if \(tellsAsYou\(text\) && attempt < 3\)/)
  assert.match(src, /endsGeneric\(text\) && attempt < 3/)
  assert.ok(!/category !== 'self'/.test(src), 'ไม่มีหมวดผู้เล่าเรื่องเองแล้ว')
})
