// ฉาก ตัวละคร อุปกรณ์ประกอบฉาก และหน้าตาผี ต้องหลากหลาย · ทุกช็อตต้องสั่งห้ามขอบขาว
//   node --test scripts/test-scene-richness.mjs
// ผู้ใช้ 23 พ.ย. 2026:
//   "ให้ chatgpt web สร้าง ฉาก ตัวละคร ให้มากกว่านี้ อุปกรประกอบฉากด้วย"
//   "ให้ chatgpt web สร้าง ผี ให้หลากหลายน่ากลัว ด้วยมีแค่แบบเดียวเดี๋ยวเบื่อ ให่มีทุกแบบเลย"
//   "แบบนี้ ห้ามทำกรอบได้ไหม" (ส่งภาพจาก Flow ที่มีขอบขาวรอบภาพมา)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WORLD_RICHNESS_RULE, SHOT_VARIETY_RULE } from '../pipeline/lib/continuity.mjs'
import { withFullBleed, FULL_BLEED_TAG } from '../pipeline/lib/prompts.mjs'
import { GHOST_LOOK_RULE, categoryRule, CATEGORIES } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('ฉาก: อย่างน้อย 4 สถานที่ต่อคลิป · อยู่ที่เดิมติดกันได้ไม่เกิน 4 ช็อต', () => {
  assert.match(WORLD_RICHNESS_RULE, /สถานที่ของคลิปนี้ไว้อย่างน้อย 4 แห่ง/)
  assert.match(WORLD_RICHNESS_RULE, /ห้ามเล่าทั้งคลิปอยู่ในห้องเดียว/)
  assert.match(WORLD_RICHNESS_RULE, /ติดกันได้ไม่เกิน 4 ช็อต/)
})

test('ตัวละคร: @TAG อย่างน้อย 4 ตัว · มีช็อตที่มีคนมากกว่า 1 คน', () => {
  assert.match(WORLD_RICHNESS_RULE, /@TAG อย่างน้อย 4 ตัว/)
  assert.match(WORLD_RICHNESS_RULE, /ชาวบ้าน\/พระ\/ผู้ใหญ่บ้าน/, 'ต้องขอตัวประกอบสำหรับฉากหมู่')
  assert.match(WORLD_RICHNESS_RULE, /1 ใน 4 ช็อตต้องมีคนมากกว่า 1 คน/)
})

test('อุปกรณ์ประกอบฉาก: รายการ 8–12 ชิ้นต่อคลิป · ห้ามใช้ชุดเดิมซ้ำทุกช็อต · ของสำคัญมี @TAG', () => {
  assert.match(WORLD_RICHNESS_RULE, /props ของคลิปนี้ 8–12 ชิ้น/)
  assert.match(WORLD_RICHNESS_RULE, /ห้ามใช้ชุดเดิมซ้ำกันทุกช็อต/)
  assert.match(WORLD_RICHNESS_RULE, /ต้องมี @TAG ของตัวเอง/)
  // กฎเดิมคุมแค่ระยะภาพ — กฎใหม่ต้องไม่ไปทับกัน
  assert.ok(!/สถานที่ของคลิปนี้/.test(SHOT_VARIETY_RULE))
})

test('กฎฉาก/ตัวละคร/props ไปถึงทั้ง 2 ทางที่ขอ Shot List จาก ChatGPT', () => {
  // ภาพของคลิปจริงมาจาก nextRoundPrompt (outputRules) ไม่ใช่ shotlistPrompt ก้อนเดียว
  assert.match(read('pipeline/lib/shotlist.mjs'), /\$\{WORLD_RICHNESS_RULE\}/)
  assert.match(read('pipeline/lib/prompts.mjs'), /\$\{WORLD_RICHNESS_RULE\}/)
})

test('ผี: ออกแบบตามชนิด ห้ามหน้าผีแบบเดียวทุกคลิป · มีชนิดผีไทยให้เลือกหลายแบบ', () => {
  assert.match(GHOST_LOOK_RULE, /ห้ามใช้หน้าผีแบบเดียวกันทุกคลิป/)
  assert.match(GHOST_LOOK_RULE, /ลักษณะเฉพาะที่คนดูแยกออกจากผีตัวอื่น 3–4 ข้อ/)
  for (const kind of ['กระสือ', 'ปอบ', 'กระหัง', 'ผีพราย', 'นางตะเคียน', 'ผีตายทั้งกลม', 'ผีกองกอย', 'ผีโพง', 'เปรต', 'ผีตายโหง']) {
    assert.ok(GHOST_LOOK_RULE.includes(kind), `ต้องมีชนิดผี: ${kind}`)
  }
  // ยังอยู่ใต้กติกาความสยอง — กระสือมีอวัยวะห้อยตามตำนาน (ผู้ใช้เลือก 23 พ.ย. 2026) แต่ต้องเป็นลายเส้นการ์ตูน ไม่มีเลือด
  // ผีตายโหงห้ามบาดแผลเปิด
  assert.match(GHOST_LOOK_RULE, /กระสือ — [^\n]*ไม่มีเลือดหยดหรือกระเซ็น ไม่ใช่ภาพผ่าตัด/)
  assert.match(GHOST_LOOK_RULE, /ห้ามบาดแผลเปิด/)
})

test('กฎหน้าตาผีใช้เฉพาะขั้นภาพของหมวดผีและไสยศาสตร์', () => {
  for (const c of CATEGORIES) {
    const image = categoryRule({ category: c.id, scare: 'medium' }, 'image')
    const script = categoryRule({ category: c.id, scare: 'medium' }, 'script')
    const scary = c.id === 'ghost' || c.id === 'saiyasat'
    assert.equal(image.includes(GHOST_LOOK_RULE), scary, `${c.id}: ขั้นภาพ`)
    assert.ok(!script.includes(GHOST_LOOK_RULE), `${c.id}: ขั้นบทไม่ต้องมีกฎหน้าตาผี`)
  }
})

test('ขอบขาว: ต่อป้าย full-bleed ท้ายคำสั่งของทุกช็อต · ไม่ต่อซ้ำ', () => {
  const tagged = withFullBleed('SHOT 01 | Chars: @hero | Env: ใต้ถุนเรือนไม้.')
  assert.ok(tagged.endsWith(`| ${FULL_BLEED_TAG}`))
  assert.ok(!tagged.includes('.|'), 'ตัดเครื่องหมายท้ายประโยคก่อนต่อป้าย')
  assert.equal(withFullBleed(tagged), tagged, 'เรียกซ้ำต้องไม่ต่อป้ายสองครั้ง')
  assert.equal(withFullBleed(''), '')
  assert.equal(withFullBleed(null), '')
  assert.match(FULL_BLEED_TAG, /no white border/)
})

test('ป้าย full-bleed ติดไปกับทุกช็อตในทุกทางที่ส่งให้ Flow', () => {
  // brief ของแผงข้าง + รอบที่ขอภาพที่ขาด + รายการช็อตที่ส่งให้ตัวขับ Flow พิมพ์ทีละภาพ
  assert.match(read('pipeline/lib/shotlist.mjs'), /\$\{s\.filename\} \$\{withFullBleed\(s\.prompt\)\}/)
  const images = read('pipeline/5_images.mjs')
  assert.match(images, /\$\{s\.filename\} \$\{withFullBleed\(s\.prompt\)\}/)
  assert.match(images, /prompt: withFullBleed\(s\.prompt\)/, 'ช็อตที่ส่งให้ตัวขับต้องมีป้ายด้วย')
})
