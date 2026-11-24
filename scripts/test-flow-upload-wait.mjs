// Flow: รอรูปแนบอัปโหลดเสร็จจริงก่อนกดส่ง · ล้างรูปค้างก่อนแนบใหม่ · Enter ไม่ติดให้กดปุ่มเริ่มสร้าง
// ผู้ใช้ 24 พ.ย. 2026 (ส่งภาพหน้า Flow ที่ช่องพิมพ์มีรูปแนบ 13 ใบ + prompt ค้าง): "เป็นอะไรอีก"
//   log: "รอ Flow รับ prompt ไม่เจอ (15 วิ)" → "วาง prompt ลงช่องพิมพ์ของ Flow ไม่ได้" ×2 → ได้ภาพ 0/31
// ทดลองกับหน้า Flow จริงแล้ว:
//   · ตอนอัปโหลด ปุ่มรูปแนบเป็น aria-busy="true" + <flow-soupy-overlay> (ไม่มีวงหมุนแบบเดิมแล้ว)
//   · กด Enter ตอนรูปยังอัปโหลด = Flow ไม่ส่ง ข้อความค้างในช่อง · รอให้ขึ้นครบแล้วกด Enter = ส่งได้ปกติ
//   · prompt ยาว 29k ตัวอักษรอย่างเดียว ส่งได้ปกติ (ไม่ใช่สาเหตุ)
//   · คลิกที่รูปแนบ = เอารูปออก
//   node --test scripts/test-flow-upload-wait.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SRC = readFileSync(new URL('../extension/content-flow-agent.js', import.meta.url), 'utf8')
const fn = (name) => {
  const i = SRC.indexOf(`async function ${name}(`)
  assert.ok(i >= 0, `ไม่เจอ ${name}`)
  return SRC.slice(i, SRC.indexOf('\n}', i) + 2)
}

test('สถานะกำลังอัปโหลดของ Flow รุ่นปัจจุบัน: aria-busy + flow-soupy-overlay (เก็บแบบวงหมุนเดิมไว้ด้วย)', () => {
  const sel = /const CHIP_BUSY = \[([\s\S]*?)\]\.join/.exec(SRC)?.[1] ?? ''
  assert.match(sel, /flow-ingredient-chip \[aria-busy="true"\]/)
  assert.match(sel, /flow-ingredient-chip flow-soupy-overlay/)
  assert.match(sel, /mat-progress-spinner/)
})

test('แนบรูปแล้วรอจนอัปโหลดเสร็จทุกใบ ไม่ใช่แค่รูปโผล่ — รอได้นาน (แผ่นแบบ PNG ~3 MB)', () => {
  const attach = fn('attachImages')
  assert.match(attach, /waitFor\(\(\) => !chipsBusy\(\), \{ timeout: 5 \* 60_000/)
  assert.ok(!/timeout: 60_000,\s*interval: 500,\s*label: 'Flow อัปโหลดรูปตัวละคร'/.test(attach), 'ห้ามกลับไปเช็กแค่วงหมุน 60 วิแบบเดิม')
})

test('ก่อนแนบรูปรอบใหม่ ล้างรูปและข้อความที่ค้างจากรอบที่ส่งไม่ออก (เคยซ้อนจนเป็น 13 ใบ)', () => {
  const clear = fn('clearLeftovers')
  assert.match(clear, /flow-ingredient-chip button\.chip-container/)
  assert.match(clear, /realClick\(chip\)/)
  const send = fn('sendPrompt')
  assert.ok(send.indexOf('await clearLeftovers()') >= 0 && send.indexOf('await clearLeftovers()') < send.indexOf('await attachImages('), 'ต้องล้างก่อนแนบ')
})

test('กดส่งเมื่อปุ่มกดได้และรูปแนบขึ้นครบ · Enter ไม่ติด → กดปุ่มเริ่มสร้างแทนหนึ่งครั้ง', () => {
  const send = fn('sendPrompt')
  assert.match(send, /!SEL\.send\(\)\.disabled && !chipsBusy\(\)/)
  const enter = send.indexOf('await trustedEnter(')
  const click = send.indexOf('realClick(send)')
  assert.ok(enter > 0 && click > enter, 'กดปุ่มเป็นทางสำรองหลัง Enter')
  assert.match(send, /if \(send && !send\.disabled && !chipsBusy\(\)\) realClick\(send\)/)
  assert.match(send, /label: 'Flow รับ prompt \(กดปุ่มเริ่มสร้าง\)'/)
})
