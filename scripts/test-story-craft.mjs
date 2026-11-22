// บทต้องมีแก่นและมีจังหวะให้ติดตาม — มีปม เดิมพัน อุปสรรค ฉากเด็ด จุดพลิก · ตัวเอกมีชื่อ ไม่ใช่ "คุณ"
//   node --test scripts/test-story-craft.mjs
// ผู้ใช้ (21 พ.ย. 2026): "คอนเทนต์สาระน้อยเกินไป ไม่มีแก่นสาร ไม่มีจังหวะที่ให้ติดตาม"
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scriptPrompt, STORY_CRAFT, endsGeneric, tellsAsYou, moodRule, reviseLengthPrompt } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const BLUEPRINT = read('extension/VDO Concept.txt')

const PROFILES = {
  sanguo: { category: 'sanguo' },
  sage: { category: 'sage' },
  tale: { category: 'tale' },
}

for (const [name, profile] of Object.entries(PROFILES)) {
  test(`คำสั่งเขียนบท (${name}): มีหัวใจของบท`, () => {
    for (const mood of ['off', 'happy']) {
      const prompt = scriptPrompt(BLUEPRINT, 'ม่อจื๊อเดินสิบวันไปห้ามสงคราม', { language: 'th', targetMinutes: 1, profile: { ...profile, mood }, engage: false })
      assert.ok(prompt.includes(STORY_CRAFT), 'ต้องมีหัวใจของบท')
      // ต้นเหตุเดิม: แนวเพิ่มความสุขห้ามตั้งปม · หมวดนิทาน/ปราชญ์ใช้ "คุณ" เป็นตัวเอก
      assert.ok(!prompt.includes('ไม่ตั้งปัญหาก่อนแล้วค่อยแก้'), 'แนวเพิ่มความสุขต้องไม่ห้ามปม')
      assert.ok(!prompt.includes('บุรุษที่ 2 ตลอด'), 'ห้ามสั่งให้เล่าบุรุษที่ 2 ทั้งเรื่อง')
    }
  })
}

test('หัวใจของบท: ปม เดิมพัน อุปสรรค ฉากเด็ด จุดพลิก ประโยคปิดผูกกับเรื่อง', () => {
  for (const re of [/ปมภายใน 3 บรรทัดแรก/, /เดิมพัน/, /อุปสรรคหนักขึ้น/, /ฉากเด็ด/, /จุดพลิก/, /ทิ้งคำถามค้าง/, /ประโยคปิดต้องผูกกับเรื่องนี้/]) assert.match(STORY_CRAFT, re)
  assert.match(moodRule('happy', 'script'), /ต้องมีปม/)
})

test('ปรับความยาว: ไม่ยืดด้วยคำสอนหรือชีวิตคนยุคนี้', () => {
  const longer = reviseLengthPrompt('th', { minutes: 0.5, target: 1, pace: 'calm' })
  assert.ok(!/ตัวอย่างในชีวิตจริง|วิธีปฏิบัติ/.test(longer))
  assert.match(longer, /ฉากเด็ด/)
})

// บทจริงจากเครื่องผลิต 21 พ.ย. 2026
const YOU_STORY = `เช้าวันนั้น... ลานประลองเต็มไปด้วยเสียงหัวเราะ
คุณยืนอยู่กลางลาน ด้วยรอยยิ้มบางๆ
จอมยุทธ์รอบข้างต่างชักดาบโชว์ฝีมือ
แต่คุณกลับยืนนิ่ง ไม่แม้แต่จะขยับมือ
เสียงหัวเราะดังขึ้น บางคนล้อว่าคุณลืมวิชาดาบแล้ว
คุณเพียงมองดอกไม้เล็กๆ ที่ปลิวผ่านปลายเท้า
กรรมการยกมือให้คุณเป็นผู้ชนะ
ก่อนเดินกลับไปเก็บดอกไม้ดอกเดิม
เพราะรอยยิ้มของคุณ... ไม่เคยต้องรอเสียงปรบมือ`

const NAMED_STORY = `ฝนตกหนักหน้าประตูเมืองซ่ง
ชายในชุดผ้าหยาบยืนเปียกปอนอยู่หน้าประตู
ยามเฝ้าประตูโบกมือไล่ ไม่ให้เข้าไปหลบฝน
ไม่มีใครรู้ว่า... เขาเพิ่งช่วยเมืองนี้ไว้ทั้งเมือง
สิบวันก่อน ม่อจื๊อได้ข่าวว่าแคว้นฉู่จะยกทัพมาตีซ่ง
ถ้าเป็นคุณ จะเดินไปห้ามกองทัพด้วยมือเปล่าไหม?
เขาเดินสิบวันสิบคืน จนรองเท้าขาด
คุณธรรมของเขาไม่ได้อยู่ในคำพูด
ม่อจื๊อปลดเข็มขัด วางเป็นกำแพงเมืองบนโต๊ะ
ยามคนนั้น... ไม่เคยรู้เลยว่าไล่ใครไปจากประตู
ถ้าเป็นคุณ จะยกโทษให้ยามคนนั้นไหม?
เล่าให้ฟังในคอมเมนต์หน่อย`

test('จับบทที่ให้ "คุณ" เป็นตัวละคร', () => {
  assert.equal(tellsAsYou(YOU_STORY), true)
  // ถามคนดู 1 ครั้งกลางเรื่อง + คำว่า "คุณธรรม" + ประโยคชวนคุยท้ายบท ไม่นับ
  assert.equal(tellsAsYou(NAMED_STORY), false)
  assert.equal(tellsAsYou('You stand in the arena.\nYou smile.\nYou wait.\nYou bow.\nThe end.\nOne.\nTwo.'), true)
})

test('จับประโยคปิดลอยๆ ที่ใช้กับเรื่องไหนก็ได้', () => {
  assert.equal(endsGeneric('ม่อจื๊อเดินกลับบ้าน\nบางครั้ง... ชัยชนะก็ไม่ต้องมีสนามรบ'), true)
  assert.equal(endsGeneric('เนินเขาเงียบลง\nบางครั้ง... เสียงในป่าก็บอกเรื่องราวมากมาย\nถ้าเป็นคุณ จะขึ้นเขาไหม?'), true)
  assert.equal(endsGeneric(NAMED_STORY), false)
  // "บางครั้ง" กลางเรื่องไม่นับ
  assert.equal(endsGeneric('บางครั้งเขาก็ตีเหล็กจนดึก\nคืนนั้นดาบเล่มนั้นเสร็จ\nเขาวางมันไว้หน้าประตู\nแล้วไม่เคยกลับมาอีกเลย'), false)
})

test('autopilot ขอเขียนใหม่เมื่อตัวเอกเป็น "คุณ" หรือปิดลอยๆ (รอบสุดท้ายยอมรับ)', () => {
  const src = read('pipeline/autopilot.mjs')
  assert.match(src, /tellsAsYou\(text\) && attempt < 3/)
  assert.match(src, /endsGeneric\(text\) && attempt < 3/)
})
