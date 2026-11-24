// วิธีได้หัวข้อคลิป: ค่าเริ่มต้น = "เลือกให้เลย" และระบบต้องไม่เปลี่ยนโหมดของผู้ใช้เอง
// ผู้ใช้ 23 พ.ย. 2026 (ส่งภาพกล่องหัวข้อคลิปที่เลือก "เลือกให้เลย"): "อยากให้ค่าเริ่มต้นเป็นค่านี้"
//   node --test scripts/test-topic-mode-default.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PANEL = readFileSync(new URL('../extension/sidepanel.js', import.meta.url), 'utf8')

test('ค่าเริ่มต้นของวิธีได้หัวข้อคือ "เลือกให้เลย" (auto)', () => {
  assert.match(PANEL, /function topicMode\(\) \{\s*return S\.autoTopicMode \?\? 'auto'\s*\}/)
  assert.ok(!/autoTopicMode \?\? 'manual'/.test(PANEL), 'ห้ามเหลือค่าเริ่มต้นแบบเก่า (พิมพ์เอง)')
})

test('ทุกจุดอ่านโหมดผ่าน topicMode() — ค่าว่างต้องไม่โชว์ว่า "เลือกให้เลย" แต่กด ▶ แล้วถูกนับเป็นพิมพ์เอง', () => {
  const reads = [...PANEL.matchAll(/S\.autoTopicMode/g)].map((m) => PANEL.slice(m.index - 40, m.index + 40))
  // เหลือได้แค่ 2 ที่: ตัวช่วยเอง และตอนผู้ใช้กดเลือกโหมด
  assert.equal(reads.length, 2, `ยังมีจุดอ่าน S.autoTopicMode ตรงๆ:\n${reads.join('\n')}`)
  assert.match(PANEL, /S\.autoTopicMode = b\.dataset\.value/, 'ผู้ใช้กดเลือกโหมด = จุดเดียวที่เปลี่ยนค่าได้')
  assert.match(PANEL, /const autoTopic = topicMode\(\) === 'auto'/, 'ปุ่ม ▶ ต้องเห็นโหมดเดียวกับที่โชว์')
  assert.match(PANEL, /const mode = topicMode\(\)/, 'ปุ่มโหมดที่ไฮไลต์ต้องมาจากค่าเดียวกัน')
})

test('กด "ทำต่อ" หรือ "เริ่มใหม่ตั้งแต่แผนก" ไม่เปลี่ยนโหมดของผู้ใช้เป็นพิมพ์เองอีก', () => {
  assert.ok(!/S\.autoTopicMode = 'manual'/.test(PANEL), 'ระบบห้ามเปลี่ยนโหมดเป็นพิมพ์เองเอง')
  // ทั้งสองทางยังส่งชื่อเรื่องไปตรงๆ — ไม่ต้องพึ่งโหมด
  assert.match(PANEL, /api\(app, '\/api\/autopilot', \{ title: r\.title,/)
  assert.match(PANEL, /api\(app, '\/api\/autopilot', \{ title: target\.title, restartFrom: stage,/)
})
