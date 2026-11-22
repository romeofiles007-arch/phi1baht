// ชื่อหัวข้อแบบปกการ์ตูนเล่มละบาท ไม่ใช่ชื่อแนวสอน/ฮาวทู — ประโยคสอนใจมีได้แค่บรรทัดปิดของบท ไม่ใช่ในชื่อ
//   node --test scripts/test-story-titles.mjs
// Task 4: ตัวอย่างชื่อเปลี่ยนจากเรื่องเล่าของแอปต้นแบบเป็นเรื่องผีไทย/นิทาน/ตลกบ้านทุ่ง · หมวดเปลี่ยนเป็น 5 หมวด
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ANGLES, STORY_TITLE_RULE, lessonTitle, scoredTopicsPrompt, CATEGORIES } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const LESSONISH = /สอน|ข้อคิด|บทเรียน|วิธี|เคล็ดลับ|ชีวิตคนยุคนี้|ใช้กับชีวิต|อธิบายใน/

test('มุมเล่าทุกแบบเป็นมุมเล่าเรื่อง ไม่มีมุมสอน/ฮาวทู', () => {
  for (const a of ANGLES) assert.ok(!LESSONISH.test(a), a)
  assert.ok(ANGLES.length >= 8)
})

test('คำสั่งเสนอหัวข้อ: มีกฎชื่อเรื่องแบบปกเล่มละบาท และไม่มีคำสั่งแนวสอนเหลือ', () => {
  for (const genre of ['mix', ...CATEGORIES.map((c) => c.id)]) {
    const p = scoredTopicsPrompt('BLUEPRINT', { genre, minutes: 1 })
    assert.ok(p.includes(STORY_TITLE_RULE), genre)
    for (const bad of ['ชื่อเรื่องบอกตรงๆ ว่าสอนเรื่องอะไร', 'คลิปต้องอธิบายด้วยหลักคิดแกน', 'ตรงกับทุกข์ใจของคนดู', 'โยงมาใช้กับชีวิตคนยุคนี้', 'จีน']) {
      assert.ok(!p.includes(bad), `${genre}: ${bad}`)
    }
  }
})

test('ทุกหมวด: หัวข้อเป็นเรื่องเล่า ไม่ใช่คำสอน', () => {
  for (const c of CATEGORIES) assert.ok(!/โยงมาใช้|บอกตรงๆ ว่าสอน|และข้อคิด|นำไปใช้ได้จริง/.test(c.topics), c.id)
})

test('Blueprint: ไม่มีมุมหัวข้อแนวสอนเหลือ', () => {
  const bp = read('extension/VDO Concept.txt')
  for (const bad of ['สอนอะไรเรื่อง ___', 'วิธี ___ แบบ ___', 'สอนคุณโดยไม่รู้ตัว', 'ที่สอนเรื่อง ___', 'ข้อคิดจาก ___']) {
    assert.ok(!bp.includes(bad), bad)
  }
})

test('จับชื่อหัวข้อแนวสอน/ฮาวทู', () => {
  for (const t of ['ข้อคิดจากผีปอบ', 'วิธีป้องกันผีแบบโบราณ', 'กรรมสอนอะไรเรา', 'บทเรียนจากนางตะเคียนที่ใช้กับชีวิตได้', 'เคล็ดลับนอนบ้านร้างให้รอด']) assert.equal(lessonTitle(t), true, t)
  for (const t of ['คืนที่กระสือมาเคาะประตูเรือนแม่หม้าย', 'ตะกรุดดอกสุดท้ายของหมอผีเฒ่า', 'ศรีธนญชัยกับยักษ์ที่หิวทั้งปี',
    'ทิดจ่อยนอนเฝ้าป่าช้าแทนเพื่อน', 'หลวงตาผู้สอนคาถาบทเดียว']) assert.equal(lessonTitle(t), false, t)
})

test('ระบบเลือกหัวข้อเล่าเรื่องก่อน ทั้ง autopilot และแผงข้าง (ถ้าทุกข้อเป็นแนวสอนก็ยังใช้ ไม่ให้งานค้าง)', () => {
  assert.match(read('pipeline/autopilot.mjs'), /storyTitlesFirst\(screened\.fresh\)/)
  assert.match(read('extension/sidepanel.js'), /S\.scoredTopics = storyTitlesFirst\(screened\.fresh\)/)
})
