// เทสต์: กันคำรุนแรง/เปลือยในคำบรรยายช็อตก่อนส่ง Flow (spec 2: ภาพโป๊/เปลือย/เลือดสาด = ล้มเหลวแม้ระบบทำงานได้)
//   node --test scripts/test-shot-safety.mjs
// กติกา: ห้ามเปลือย/เรื่องเพศ · ห้ามไส้ ศพแหลก บาดแผลชัด · เลือดได้เล็กน้อย (คำว่า "เลือด" เฉยๆ ไม่ตัด)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sanitizeShotPrompt, BANNED_GORE } from '../pipeline/lib/shot-safety.mjs'
import { TOPIC_SEEDS } from '../extension/prompts.js'

const banned = (text) => BANNED_GORE.some((re) => new RegExp(re.source, re.flags.replace('g', '')).test(text))

test('(Review Focus 1) ตัดไส้ เลือดสาด ศพ เปลือย ออก และไม่เหลือคำต้องห้าม', () => {
  const { text, removed } = sanitizeShotPrompt('กระสือ ไส้ห้อยเลือดสาด ศพเปลือย')
  for (const word of ['ไส้', 'เลือดสาด', 'ศพ', 'เปลือย']) assert.ok(removed.includes(word), `${word} ใน ${JSON.stringify(removed)}`)
  assert.ok(!banned(text), text)
  assert.match(text, /กระสือ/) // คำอื่นอยู่ครบ
})

test('คำบรรยายปกติไม่ถูกแตะ', () => {
  const { text, removed } = sanitizeShotPrompt('หญิงสาวยืนใต้ต้นตะเคียน')
  assert.deepEqual(removed, [])
  assert.equal(text, 'หญิงสาวยืนใต้ต้นตะเคียน')
})

test('คำปกติที่หน้าตาคล้ายคำต้องห้าม (ไส้ตะเกียง โลงศพ งานศพ หยดเลือด) ไม่ถูกตัด', () => {
  for (const ok of [
    'ตะเกียงน้ำมันไส้ตะเกียงริบหรี่บนโต๊ะ',
    'โลงศพเก่าในศาลาวัดร้าง',
    'ชาวบ้านมางานศพยามค่ำ',
    'หยดเลือดเล็กน้อยที่มุมปากผี',
    'ไส้กรอกอีสานในตลาดนัด',
    'Env: bamboo grove at night, oil lamp, blood drop at the corner of the mouth',
  ]) {
    const { text, removed } = sanitizeShotPrompt(ok)
    assert.deepEqual(removed, [], ok)
    assert.equal(text, ok)
  }
})

test('คำภาษาอังกฤษและคำรุนแรงอื่นก็ถูกตัด (ช็อตภาษาอังกฤษ)', () => {
  const { text, removed } = sanitizeShotPrompt('Env: hut | Action: krasue with guts and entrails, naked body, decapitated corpse, open wound, blood splatter')
  for (const word of ['guts', 'entrails', 'naked', 'decapitated', 'corpse', 'open wound', 'blood splatter']) {
    assert.ok(removed.map((w) => w.toLowerCase()).includes(word), `${word} ใน ${JSON.stringify(removed)}`)
  }
  assert.ok(!banned(text), text)
  assert.match(text, /^Env: hut \| Action: krasue/) // คง field และ | ไว้ให้ parser
  const th = sanitizeShotPrompt('ผีหัวขาดเดินมา แผลเหวอะ ศพแหลกเหลว เลือดท่วมพื้น')
  assert.ok(th.removed.length >= 4, JSON.stringify(th.removed))
  assert.ok(!banned(th.text), th.text)
})

test('ข้อมูลแปลก ๆ ไม่ throw', () => {
  assert.deepEqual(sanitizeShotPrompt(undefined), { text: '', removed: [] })
  assert.deepEqual(sanitizeShotPrompt(''), { text: '', removed: [] })
  assert.ok(BANNED_GORE.length >= 8 && BANNED_GORE.every((re) => re instanceof RegExp))
})

test('5_images.mjs ผ่าน sanitizeShotPrompt กับทุก s.prompt (ช็อต ปก ปริศนา) ก่อนส่ง Flow และ log คำที่ตัด', () => {
  const src = readFileSync(new URL('../pipeline/5_images.mjs', import.meta.url), 'utf8')
  assert.match(src, /import \{ sanitizeShotPrompt \} from '\.\/lib\/shot-safety\.mjs'/)
  // ฟังก์ชันกลางตัดคำ + log
  assert.match(src, /function safeShot\(s\) \{[\s\S]*?sanitizeShotPrompt\(s\.prompt\)[\s\S]*?removed\.length[\s\S]*?console\.log\([\s\S]*?removed\.join/)
  // ทุกแหล่งของช็อตที่ส่ง Flow ผ่าน safeShot
  assert.match(src, /const allShots = [\s\S]*?\.map\(\(s\) => safeShot\(/)
  assert.match(src, /safeShot\(coverShot\(/)
  assert.match(src, /safeShot\(riddleShot\(/)
})

test('(M3) หัวข้อผีไม่มี "ผีหัวขาด" (ชวนวาดภาพหัวขาด)', () => {
  assert.ok(!TOPIC_SEEDS.ghost.subjects.some((s) => /หัวขาด/.test(s)))
  for (const s of TOPIC_SEEDS.ghost.subjects) assert.deepEqual(sanitizeShotPrompt(s).removed, [], s)
})
