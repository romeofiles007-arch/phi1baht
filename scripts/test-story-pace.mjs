// จังหวะเล่าเรื่อง — ผู้ใช้ 23 พ.ย. 2026: "เนื้อเรื่องมันวกวนมากเลย ดูแล้วไม่ค่อยเข้าใจ ลองไปอ่านดูสิ"
//
// ต้นเหตุคือกฎของเราเองคูณกัน: lengthTarget สั่ง "1 นาที ≈ 21 บรรทัด" + STORY_CRAFT สั่ง
// "ทุกบรรทัดต้องดันเรื่องไปข้างหน้า เพิ่มข้อมูลใหม่" = 21 ข้อมูลใหม่ใน 60 วินาที
// คลิปที่ล้ม (เงาในกระจก) ออกมา 24 บรรทัด 19 เหตุการณ์ ใน 1:27
//   node --test scripts/test-story-pace.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STORY_PACE, STORY_MECHANIC, FRESH_WORDING_RULE, STORY_CRAFT, STORY_REVEAL, STOCK_PHRASES, stockPhrases, lengthTarget, paceOf, scriptPrompt } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('ความยาวบอกชัดว่าบรรทัดไม่ใช่เหตุการณ์ และบอกเพดานเหตุการณ์ตามนาที', () => {
  for (const [minutes, lo] of [[1, 7], [2, 14]]) {
    const t = lengthTarget('th', minutes, 150, paceOf())
    assert.match(t, /จำนวนบรรทัดนี้ \*\*ไม่ใช่\*\* จำนวนเหตุการณ์/, `${minutes} นาที: ต้องบอกว่าบรรทัด ≠ เหตุการณ์`)
    assert.ok(t.includes(`${lo}–`), `${minutes} นาที: เพดานเหตุการณ์ต้องเริ่มที่ ${lo}`)
    assert.match(t, /หนึ่งเหตุการณ์กิน 2–4 บรรทัด/)
  }
  // ภาษาอังกฤษไม่ได้นับบรรทัด จึงไม่ต้องมีบรรทัดนี้
  assert.ok(!lengthTarget('en', 1).includes('เหตุการณ์'))
})

test('STORY_PACE: เพดานเหตุการณ์ต่อนาที · หนึ่งเหตุการณ์ 2–4 บรรทัด · บทสั้นให้ขยาย ไม่ใช่เพิ่มเหตุการณ์', () => {
  assert.match(STORY_PACE, /1 นาที = \*\*6–8 เหตุการณ์\*\*/)
  assert.match(STORY_PACE, /1\.5 นาที = 9–11/)
  assert.match(STORY_PACE, /2 นาที = 12–15/)
  assert.match(STORY_PACE, /แต่ละเหตุการณ์เขียน 2–4 บรรทัดติดกัน/)
  assert.match(STORY_PACE, /ขยายเหตุการณ์ที่มีอยู่ให้ลึกขึ้น\*\* ห้ามแก้ด้วยการเพิ่มเหตุการณ์/)
  // ตัวอย่างผิด/ถูกต้องมีคู่กัน ไม่ใช่มีแต่กฎลอยๆ
  assert.match(STORY_PACE, /ตัวอย่างที่ผิด/)
  assert.match(STORY_PACE, /ตัวอย่างที่ถูก/)
})

test('STORY_CRAFT เลิกสั่ง "ทุกบรรทัดต้องเพิ่มข้อมูลใหม่" แล้ว — นั่นคือกฎที่ทำให้บทยัดแน่น', () => {
  assert.ok(!STORY_CRAFT.includes('ทุกบรรทัดต้องดันเรื่องไปข้างหน้า** — เพิ่มปม เดิมพัน หรือข้อมูลใหม่'), 'กฎเดิมยังอยู่ จะกลับไปยัดเหตุการณ์อีก')
  assert.match(STORY_CRAFT, /\*\*ทุกเหตุการณ์ต้องดันเรื่องไปข้างหน้า\*\*/)
  assert.match(STORY_CRAFT, /บรรทัดที่ขยายเหตุการณ์เดิม.*ถือว่าทำงานแล้ว/)
})

test('ตัวละครที่มีชื่อต้องมีหน้าที่ · ฉากที่ไม่มีผลต้องตัด (แก้การตีกันกับกฎ "ตัวละคร ≥4 ตัว" ของขั้นภาพ)', () => {
  assert.match(STORY_CRAFT, /ตัวละครที่มีชื่อต้องทำอย่างน้อย 1 อย่างที่เปลี่ยนเรื่อง/)
  assert.match(STORY_CRAFT, /ฉากที่ไม่มีผลต่อเรื่องต้องตัดทิ้ง/)
  // กฎขั้นภาพยังขอให้มีคนในเฟรมหลายคนได้ แต่ต้องไม่บังคับให้ "ตั้งชื่อ" ทุกคน
  assert.match(STORY_CRAFT, /ฉากหมู่มีคนหลายคนได้ แต่คนที่มีชื่อต้องมีหน้าที่/)
})

test('STORY_MECHANIC: ของเหนือธรรมชาติต้องมีกฎ บอกในครึ่งแรก ห้ามเพิ่มกฎใหม่ตอนเฉลย', () => {
  assert.match(STORY_MECHANIC, /บอกกฎออกมาเป็นคำพูดในครึ่งแรก/)
  assert.match(STORY_MECHANIC, /ห้ามเพิ่มกฎใหม่/)
  assert.match(STORY_MECHANIC, /กฎที่โผล่มาตอนจบเท่ากับไม่ได้เฉลย/)
  assert.match(STORY_MECHANIC, /ให้เปลี่ยนเป็นของธรรมดา/, 'คิดกฎไม่ได้ต้องมีทางออก ไม่ใช่ปล่อยให้เขียนของขลังลอยๆ')
})

test('STORY_REVEAL: เฉลยชั้นเดียว (คลิปโรงพยาบาลเฉลยตัวตนผี + ความจริงของบาตร ในบรรทัดเดียว)', () => {
  assert.match(STORY_REVEAL, /หนึ่งเรื่องเฉลยชั้นเดียว/)
  assert.match(STORY_REVEAL, /ห้ามเฉลยสองเรื่องซ้อนกันในบรรทัดเดียวหรือติดกัน/)
})

test('ห้ามสำนวนผีสำเร็จรูป — คำที่ 5 คลิปแรกใช้ซ้ำต้องอยู่ในรายการห้าม', () => {
  for (const w of ['ตาโปน', 'ฟันแหลม', 'เสียงแหบ', 'ผมกระเซิง']) {
    assert.ok(STOCK_PHRASES.includes(w), `"${w}" ใช้ซ้ำในคลิปจริง ต้องห้าม`)
    assert.ok(FRESH_WORDING_RULE.includes(w), `กฎต้องเขียน "${w}" ออกมาให้ ChatGPT เห็น`)
  }
  assert.match(FRESH_WORDING_RULE, /ฉากเผชิญหน้าผีแบบประชิดหน้ามีได้ครั้งเดียวต่อเรื่อง/)
})

test('stockPhrases จับสำนวนซ้ำได้จริงจากบทที่ผู้ใช้บอกว่าอ่านไม่เข้าใจ', () => {
  const found = stockPhrases('เงาผอมยืนนิ่งตรงทางเดิน... ตาโปน ฟันแหลม ผมกระเซิงปิดหน้า\n"คืนของข้ามา..." เสียงแหบพร่าดังก้อง')
  assert.deepEqual(found.sort(), ['ตาโปน', 'ผมกระเซิง', 'ฟันแหลม', 'เสียงแหบ'].sort())
  assert.deepEqual(stockPhrases('เงาบางเหมือนควันยืนอยู่ปลายทางเดิน น้ำหยดจากชายผ้าเป็นจังหวะ'), [], 'บรรยายเองไม่โดนจับ')
  assert.deepEqual(stockPhrases(''), [])
  assert.deepEqual(stockPhrases(null), [])
})

test('กฎใหม่ทั้ง 3 ข้อถูกส่งไปกับคำสั่งเขียนบทจริง', () => {
  const p = scriptPrompt('V1 ผี 1 บาท (Blueprint ย่อสำหรับเทสต์)', 'บ้านร้างท้ายซอย', { language: 'th', targetMinutes: 1 })
  for (const [name, rule] of [['STORY_PACE', STORY_PACE], ['STORY_MECHANIC', STORY_MECHANIC], ['FRESH_WORDING_RULE', FRESH_WORDING_RULE]]) {
    assert.ok(p.includes(rule), `คำสั่งเขียนบทไม่มี ${name} — กฎที่ไม่ได้ส่งไปก็ไม่มีผล`)
  }
  // ลำดับ: จังหวะ → กลไก → สำนวน → เฉลย (เฉลยอยู่ท้ายสุดเพราะพูดถึงช่วงท้ายของบท)
  assert.ok(p.indexOf(STORY_PACE) < p.indexOf(STORY_REVEAL))
})

test('autopilot ขอเขียนใหม่เมื่อบทใช้สำนวนสำเร็จรูป ≥2 คำ (เหมือน lacksReveal)', () => {
  const src = read('pipeline/autopilot.mjs')
  assert.match(src, /stockPhrases\b/)
  assert.match(src, /stock\.length >= 2 && attempt < 3/, 'คำเดียวอาจบังเอิญ สองคำขึ้นไปคือชุดสำเร็จรูป')
  assert.match(src, /ห้ามใช้คำเหล่านี้เลย/, 'คำสั่งเขียนใหม่ต้องบอกคำที่ห้ามไปด้วย')
  // รอบสุดท้ายต้องยอมรับ ไม่ให้งานผลิตค้างเพราะคำบรรยาย
  assert.ok(src.indexOf('stock.length >= 2') > 0 && src.includes('attempt < 3'))
})
