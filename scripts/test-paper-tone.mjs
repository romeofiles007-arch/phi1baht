// ลายเส้นจีนโบราณออกมาพื้นเหลือง (กระดาษสาเก่า) แม้ prompt ห้ามแล้ว → ปรับสมดุลสีให้พื้นกระดาษเป็นขาวกลาง
//   node --test scripts/test-paper-tone.mjs
// ผู้ใช้ (20 พ.ย. 2026) ส่งภาพจากคลิปจริง 4 ภาพ: "อยากได้โหมดลายเส้นจีนโบราณแบบนี้แต่ไม่เหลือง"
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { paperGains } from '../pipeline/lib/paper-tone.mjs'

/** ภาพจำลอง: n พิกเซลสีเดียว ต่อกันเป็น rgb24 */
const fill = (parts) => Buffer.from(parts.flatMap(([rgb, n]) => Array.from({ length: n }, () => rgb).flat()))

test('พื้นกระดาษเหลืองนวล → ดึงฟ้า/เขียวขึ้นให้พื้นเป็นขาวกลาง (แดงไม่ถูกลด)', () => {
  const beige = fill([[[226, 212, 182], 700], [[60, 80, 110], 300]]) // กระดาษ 70% + ชุดคราม 30%
  const g = paperGains(beige)
  assert.ok(g, 'ต้องปรับ')
  assert.equal(g.r, 1)
  assert.ok(g.g > 1 && g.b > g.g, JSON.stringify(g))
  // หลังปรับ พื้นกระดาษห่างกันไม่เกิน 2 ระดับสี = ขาวกลาง
  const [r, gg, b] = [226 * g.r, 212 * g.g, 182 * g.b]
  assert.ok(Math.max(r, gg, b) - Math.min(r, gg, b) <= 2, `${r} ${gg} ${b}`)
})

test('ภาพที่พื้นเป็นกลาง/โทนเย็นอยู่แล้ว → ไม่แตะ', () => {
  assert.equal(paperGains(fill([[[240, 242, 244], 600], [[40, 70, 60], 400]])), null)
  assert.equal(paperGains(fill([[[205, 222, 236], 800], [[30, 40, 70], 200]])), null)
})

test('ฉากกลางคืนโคมแดง: จุดสว่างคือเปลวโคม (สีจัด) ไม่ใช่กระดาษ → ไม่แตะ ไม่ทำให้ฉากอมฟ้า', () => {
  const night = fill([[[255, 150, 40], 40], [[20, 30, 60], 900], [[90, 100, 130], 60]])
  assert.equal(paperGains(night), null)
})

test('เหลืองจัดมากก็ปรับแค่พอดี (เพดาน ×1.35) ไม่ให้สีเพี้ยน', () => {
  const g = paperGains(fill([[[236, 214, 170], 900], [[50, 50, 50], 100]])) // ฟ้าขาด ×1.39 → เพดาน
  assert.ok(g && g.b === 1.35 && g.g <= 1.35, JSON.stringify(g))
})

test('ใช้กับลายเส้นจีนโบราณเท่านั้น และเก็บภาพต้นฉบับไว้', () => {
  const src = readFileSync(new URL('../pipeline/5_images.mjs', import.meta.url), 'utf8')
  assert.match(src, /if \(profile\?\.artStyle === 'inkwash'\)/)
  assert.match(src, /neutralizePaper\(/)
  const lib = readFileSync(new URL('../pipeline/lib/paper-tone.mjs', import.meta.url), 'utf8')
  assert.match(lib, /'_original'/)
})

test('prompt ลายเส้นจีนโบราณบอกพื้นเป็นผ้าไหมขาวสะอาด (บอกสิ่งที่อยากได้ ไม่ใช่แค่ข้อห้าม) และเป็นแบบกงปี่', async () => {
  const { ART_STYLES } = await import('../extension/prompts.js')
  const s = ART_STYLES.inkwash
  for (const text of [s.rule, s.flow]) {
    assert.match(text, /gongbi|กงปี่/i)
    assert.match(text, /clean bright white silk|ผ้าไหมขาวสะอาด/)
    assert.match(text, /neutral white balance|สมดุลแสงขาวเป็นกลาง/)
  }
})
