// บทเล่าเรื่องอย่างเดียว ไม่ทิ้งท้ายด้วยข้อคิด · ปิดด้วยประโยคเฉียบคมสั้นๆ ประโยคเดียว
//   node --test scripts/test-story-ending.mjs
// ผู้ใช้ (20 พ.ย. 2026): "ส่วนใหญ่จะทิ้งท้ายด้วยข้อคิด ให้หยุดการทิ้งท้ายด้วยข้อคิด เราจะเล่าให้ฟังอย่างเดียว
// แต่จะทิ้งแค่ประโยคอันเฉียบคมสั้นๆ ไว้เพียงประโยคเดียวตอนปิด"
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scriptPrompt, STORY_ENDING, endsWithLesson } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const BLUEPRINT = read('extension/VDO Concept.txt')
// คำสั่งที่ทำให้ ChatGPT ปิดด้วยข้อคิด — ห้ามเหลือที่ไหนในคำสั่งเขียนบท (นอกจากในกฎตอนจบเองที่ห้ามไว้)
const LESSON_ASKS = [/ถอดข้อคิด/, /ข้อคิด 1 อย่าง/, /Modern Mirror/, /ตัวอย่างในชีวิตวันนี้/, /สรุปข้อคิด/, /วิธีเอาไปใช้/, /ใช้ชื่อหลักคิดนี้ในบท/,
  /ปิดด้วยข้อคิด/, /สุภาษิตนี้จึงหมายถึง/, /พาเรื่องกลับมาสู่ชีวิตคนดู/, /โยงเป็นวิธีคิดที่ใช้กับงานและชีวิต/, /reframe ใหม่ด้วยข้อคิด/]

const PROFILES = {
  novel: { category: 'sanguo', narration: 'novel' },
  history: { category: 'sanguo', narration: 'history' },
  sage: { category: 'sage' },
  tale: { category: 'tale' },
  self: { category: 'self', self: { name: 'ทดสอบ' } },
}

for (const [name, profile] of Object.entries(PROFILES)) {
  test(`คำสั่งเขียนบท (${name}): มีกฎตอนจบ และไม่มีคำสั่งให้ถอดข้อคิดเหลืออยู่`, () => {
    const prompt = scriptPrompt(BLUEPRINT, 'เปาบุ้นจิ้นกับคดีแมวสลับองค์ชาย', {
      language: 'th', targetMinutes: 1, profile, theme: { area: 'การงานและเพื่อนร่วมงาน', dhamma: 'ความเที่ยงตรงที่ไม่เกรงอำนาจ' }, engage: false,
    })
    assert.ok(prompt.includes(STORY_ENDING), 'ต้องมีกฎตอนจบ')
    const rest = prompt.split(STORY_ENDING).join('')
    // ข้อห้าม ("ไม่ถอดข้อคิด" "ห้ามบอกวิธีเอาไปใช้") ไม่นับ — นับเฉพาะที่สั่งให้ทำ
    for (const re of LESSON_ASKS) assert.ok(!new RegExp(String.raw`(?<!(?:ไม่|ห้าม)[^\s·—,]{0,8})(?:${re.source})`).test(rest), `ยังมีคำสั่ง ${re}`)
  })
}

test('กฎตอนจบ: เล่าอย่างเดียว ห้ามสอน · ปิดด้วยประโยคเฉียบคม 1 ประโยค', () => {
  assert.match(STORY_ENDING, /เล่าเรื่องอย่างเดียว/)
  assert.match(STORY_ENDING, /ห้ามถอดข้อคิด/)
  assert.match(STORY_ENDING, /ประโยคเฉียบคมสั้นๆ เพียง 1 ประโยค/)
})

test('จับบทที่ยังปิดด้วยข้อคิด', () => {
  const story = ['ลมหนาวพัดผ่านศาลไคฟง', 'เปาบุ้นจิ้นวางพู่กันลงช้าๆ', 'แล้วสั่งให้เปิดประตูศาล']
  assert.equal(endsWithLesson([...story, 'ความจริง ไม่เคยกลัวใครทั้งนั้น'].join('\n')), false)
  assert.equal(endsWithLesson([...story, 'เรื่องนี้สอนเราว่า ความซื่อตรงสำคัญกว่าอำนาจ', 'ลองนำไปใช้ในที่ทำงานดูนะครับ'].join('\n')), true)
  assert.equal(endsWithLesson([...story, 'ข้อคิดจากเรื่องนี้คือ อย่ากลัวที่จะพูดความจริง'].join('\n')), true)
  assert.equal(endsWithLesson([...story, 'ในชีวิตจริงของเรา ก็มีเปาบุ้นจิ้นซ่อนอยู่ในใจทุกคน'].join('\n')), true)
  assert.equal(endsWithLesson('那一夜，包拯没有睡。\n这个故事告诉我们，公正比权力更重要。'), true)
  assert.equal(endsWithLesson('The gate opened.\nThe lesson here is simple: truth fears no one.'), true)
  // คำว่า "สอน" ในเนื้อเรื่องเอง (อาจารย์สอนศิษย์) ไม่ใช่การสรุปบทเรียน
  assert.equal(endsWithLesson('อาจารย์สอนศิษย์ให้ฟันดาบทุกเช้า\nจนวันหนึ่ง ดาบเล่มนั้นไม่เคยถูกชักออกจากฝักอีกเลย'), false)
})

test('autopilot ขอเขียนใหม่เมื่อบทปิดด้วยข้อคิด (รอบสุดท้ายยอมรับ ไม่ให้งานค้าง)', () => {
  const src = read('pipeline/autopilot.mjs')
  assert.match(src, /if \(endsWithLesson\(text\) && attempt < 3\)/)
})
