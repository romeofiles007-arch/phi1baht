// ตอนจบแบบการ์ตูนเล่มละบาท — เรื่องจบในคลิปเสมอ แล้วปิดด้วยประโยคสอนใจ 1 ประโยค (หมวดตลก = มุกปิด)
//   node --test scripts/test-story-ending.mjs
// Task 4 (ผี 1 บาท): แอปต้นแบบห้ามปิดด้วยข้อคิดเลย ("เล่าอย่างเดียว ประโยคเฉียบคมประโยคเดียว")
// เล่มละบาทจริงปิดด้วยประโยคสอนใจบรรทัดเดียว ("ทำกรรมใดไว้ ย่อมได้รับผลนั้น") → ตัวจับเปลี่ยนเป็นจับเฉพาะการเทศนายาวหลายบรรทัด
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scriptPrompt, STORY_ENDING, endsWithLecture, endsCliffhanger, CATEGORIES } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const BLUEPRINT = read('extension/VDO Concept.txt')
// คำสั่งที่ทำให้ ChatGPT เทศนายาวหรือจบค้าง — ห้ามเหลือที่ไหนในคำสั่งเขียนบท (นอกจากในกฎตอนจบเองที่ห้ามไว้)
const BAD_ASKS = [/ถอดข้อคิด/, /สรุปข้อคิด/, /วิธีเอาไปใช้/, /ข้อคิดหลายข้อ/, /พาเรื่องกลับมาสู่ชีวิตคนดู/, /โยงเป็นวิธีคิดที่ใช้กับงานและชีวิต/, /ติดตามตอนต่อไป/, /ภาคต่อ/]

for (const c of CATEGORIES) {
  test(`คำสั่งเขียนบท (${c.id}): มีกฎตอนจบ และไม่มีคำสั่งให้เทศนาหรือจบค้างเหลืออยู่`, () => {
    const prompt = scriptPrompt(BLUEPRINT, 'คืนที่กระสือมาเคาะประตูเรือนแม่หม้าย', {
      language: 'th', targetMinutes: 1, profile: { category: c.id, scare: 'medium' }, theme: { subject: 'กระสือ', core: 'โลภทองที่ฝังไว้กับศพ' }, engage: false,
    })
    assert.ok(prompt.includes(STORY_ENDING), 'ต้องมีกฎตอนจบ')
    const rest = prompt.split(STORY_ENDING).join('')
    // ข้อห้าม ("ห้ามไล่ข้อคิดหลายข้อ" "ห้าม 'ติดตามตอนต่อไป'") ไม่นับ — นับเฉพาะที่สั่งให้ทำ
    for (const re of BAD_ASKS) assert.ok(!new RegExp(String.raw`(?<!(?:ไม่|ห้าม)[^\s·—,]{0,8}\s?["“]?)(?:${re.source})`).test(rest), `${c.id}: ยังมีคำสั่ง ${re}`)
  })
}

test('กฎตอนจบ: จบในคลิป · ประโยคปิดสอนใจ 1 ประโยค · ตลกปิดด้วยมุก · ไม่เทศนาต่อ', () => {
  assert.match(STORY_ENDING, /จบในคลิปนี้เสมอ/)
  assert.match(STORY_ENDING, /ประโยคปิดสอนใจแบบเล่มละบาทเพียง 1 ประโยค/)
  assert.match(STORY_ENDING, /หมวดตลกบ้านทุ่ง: ปิดด้วยมุกปิด 1 ประโยค/)
  assert.match(STORY_ENDING, /ห้ามเทศนาต่อหลังประโยคปิด/)
})

test('จับบทที่เทศนาข้อคิดหลายบรรทัดตอนท้าย · ประโยคปิดบรรทัดเดียวผ่าน', () => {
  const story = ['ตีสองคืนเดือนมืด ไฟตะเกียงบนเรือนยายเผื่อนดับเอง', 'ไอ้คงขุดโคนต้นตะเคียนจนเจอโอ่ง', 'ข้างในไม่มีทองสักเม็ด มีแต่ผมยาวสีดำ']
  assert.equal(endsWithLecture([...story, 'ทำกรรมใดไว้ ย่อมได้รับผลนั้น'].join('\n')), false)
  assert.equal(endsWithLecture([...story, 'ทองที่ขุดจากใต้ต้นตะเคียน... ไม่เคยเป็นของคนเป็น', 'ถ้าเป็นคุณ จะขุดโอ่งใบนั้นไหม?'].join('\n')), false, 'ประโยคปิด + ชวนคุย')
  assert.equal(endsWithLecture([...story, 'เรื่องนี้สอนให้รู้ว่า ความโลภนำมาซึ่งหายนะ'].join('\n')), false, 'แบบเล่มละบาทบรรทัดเดียวยังได้')
  assert.equal(endsWithLecture([...story, 'เรื่องนี้สอนเราว่า อย่าโลภของคนตาย', 'ข้อคิดที่สองคือ เคารพเจ้าที่เจ้าทาง', 'ลองนำไปใช้ในชีวิตจริงดูนะครับ'].join('\n')), true)
  assert.equal(endsWithLecture('The jar was empty.\nThe lesson is simple.\nIt teaches us to respect the dead.'), true)
  // คำว่า "สอน" ในเนื้อเรื่อง (ครูสอนคาถา) ไม่ใช่การเทศนา
  assert.equal(endsWithLecture('หลวงตาสอนคาถาให้ทิดมาบทเดียว\nคืนนั้นทิดมาท่องผิดหน้า\nผีทั้งป่าช้าจึงลุกมาฟัง'), false)
})

test('จับบทที่จบค้าง "ติดตามตอนต่อไป"', () => {
  assert.equal(endsCliffhanger('ประตูค่อยๆ เปิดออก...\nแล้วเธอก็เห็นมัน\nติดตามตอนต่อไป'), true)
  assert.equal(endsCliffhanger('ประตูค่อยๆ เปิดออก...\nคราวหน้าจะเล่าว่าใครยืนอยู่ตรงนั้น'), true)
  assert.equal(endsCliffhanger('ประตูค่อยๆ เปิดออก...\nไม่มีใครอยู่ตรงนั้นเลย\nทำกรรมใดไว้ ย่อมได้รับผลนั้น'), false)
})

test('autopilot ขอเขียนใหม่เมื่อบทเทศนายาวหรือจบค้าง (รอบสุดท้ายยอมรับ ไม่ให้งานค้าง)', () => {
  const src = read('pipeline/autopilot.mjs')
  assert.match(src, /if \(endsWithLecture\(text\) && attempt < 3\)/)
  assert.match(src, /if \(endsCliffhanger\(text\) && attempt < 3\)/)
  assert.ok(!/endsWithLesson/.test(src))
})
