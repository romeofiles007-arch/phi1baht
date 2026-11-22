// ชื่อหัวข้อแบบเล่าเรื่อง ไม่ใช่ชื่อแนวสอน/ฮาวทู — ให้ตรงกับบทที่เล่าอย่างเดียว ไม่ถอดข้อคิด
//   node --test scripts/test-story-titles.mjs
// ผู้ใช้ (20 พ.ย. 2026) ตกลงให้เปลี่ยน: ชื่อเดิมอย่าง "วิธีเตรียมตัวก่อนวันสอบแบบขงจื๊อ" "เม่งจื๊อสอนอะไรเรื่อง…"
// สัญญาว่าจะสอน แต่บทเล่าเรื่องอย่างเดียวแล้ว
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ANGLES, STORY_TITLE_RULE, lessonTitle, scoredTopicsPrompt, CATEGORIES } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const LESSONISH = /สอน|ข้อคิด|บทเรียน|วิธี|เคล็ดลับ|ชีวิตคนยุคนี้|ใช้กับชีวิต|อธิบายใน/

test('มุมเล่าทุกแบบเป็นมุมเล่าเรื่อง ไม่มีมุมสอน/ฮาวทู', () => {
  for (const a of ANGLES) assert.ok(!LESSONISH.test(a), a)
  assert.ok(ANGLES.length >= 5)
})

test('คำสั่งเสนอหัวข้อ: มีกฎชื่อเรื่องแบบเล่าเรื่อง และไม่มีคำสั่งแนวสอนเหลือ', () => {
  for (const genre of ['mix', 'sanguo', 'sage', 'tale']) {
    const p = scoredTopicsPrompt('BLUEPRINT', { genre, minutes: 1 })
    assert.ok(p.includes(STORY_TITLE_RULE), genre)
    for (const bad of ['ชื่อเรื่องบอกตรงๆ ว่าสอนเรื่องอะไร', 'คลิปต้องอธิบายด้วยหลักคิดแกน', 'ตรงกับทุกข์ใจของคนดู', 'โยงมาใช้กับชีวิตคนยุคนี้']) {
      assert.ok(!p.includes(bad), `${genre}: ${bad}`)
    }
  }
})

test('ทุกหมวด: หัวข้อเป็นเรื่องเล่า ไม่ใช่คำสอน', () => {
  for (const c of CATEGORIES) assert.ok(!/โยงมาใช้|บอกตรงๆ ว่าสอน|และข้อคิด|นำไปใช้ได้จริง/.test(c.topics), c.id)
})

test('Blueprint: ไม่มีมุมหัวข้อแนวสอนเหลือ', () => {
  const bp = read('extension/VDO Concept.txt')
  for (const bad of ['สอนอะไรเรื่อง ___', 'วิธี ___ แบบ ___', 'สอนคุณโดยไม่รู้ตัว', 'ที่สอนเรื่อง ___', 'ตือโป๊ยก่ายสอนเรื่อง', 'ปัญญาจีนกับการทำงาน']) {
    assert.ok(!bp.includes(bad), bad)
  }
})

test('จับชื่อหัวข้อแนวสอน/ฮาวทู', () => {
  for (const t of ['วิธีเตรียมตัวก่อนวันสอบแบบขงจื๊อ: เรียนรู้ให้พร้อม', 'เม่งจื๊อสอนอะไรเรื่องใช้คนให้ถูกกับงาน', 'ข้อคิดจากชายชราเสียม้า',
    'สิ่งที่คำพูดอ่อนโยนของเล่าจื๊อสอนคุณโดยไม่รู้ตัว', 'บทเรียนจากศึกผาแดงที่ใช้กับชีวิตได้']) assert.equal(lessonTitle(t), true, t)
  for (const t of ['เปาบุ้นจิ้นกับคดีแมวสลับองค์ชาย', 'คืนที่ขงเบ้งเปิดประตูเมืองร้าง', 'หันสินลอดหว่างขาคนพาลกลางตลาด',
    'ฌ้อปาอ๋องกับเพลงจากบ้านเกิดในคืนสุดท้าย', 'อาจารย์ผู้สอนดาบที่ไม่เคยชักดาบ']) assert.equal(lessonTitle(t), false, t)
})

test('ระบบเลือกหัวข้อเล่าเรื่องก่อน ทั้ง autopilot และแผงข้าง (ถ้าทุกข้อเป็นแนวสอนก็ยังใช้ ไม่ให้งานค้าง)', () => {
  assert.match(read('pipeline/autopilot.mjs'), /storyTitlesFirst\(screened\.fresh\)/)
  assert.match(read('extension/sidepanel.js'), /S\.scoredTopics = storyTitlesFirst\(screened\.fresh\)/)
})
