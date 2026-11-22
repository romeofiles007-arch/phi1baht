// extension ID ต้องตรงกันทุกที่ — ไม่ตรง Chrome ปฏิเสธ native host ("forbidden") แผงข้างเชื่อมโปรแกรมไม่ได้
//   node --test scripts/test-extension-id.mjs
// เจอจริง 20 พ.ย. 2026 เครื่อง 24hrs: native/extension-id.txt ค้าง ID ของแอปเดิม (ojcbjifg…)
// ตัวติดตั้งเขียน ID นั้นลงไฟล์ลงทะเบียน native host แต่ extension จริง (คำนวณจาก key ใน manifest) คือ cpehcglc… (ID ใหม่ของ ผี 1 บาท)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
/** ID ที่ Chrome ให้ extension แบบ unpacked ที่มี key: sha256(key) 32 ตัวแรก แปลง 0–f เป็น a–p */
const idFromKey = (key) => [...createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex').slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')

const manifest = JSON.parse(read('extension/manifest.json'))
const ID = idFromKey(manifest.key)

test('extension-id.txt ตรงกับ ID ที่ Chrome คำนวณจาก key ใน manifest', () => {
  assert.equal(ID, 'cpehcglcaappemnbeebdjfkidngddlih')
  assert.equal(read('native/extension-id.txt').trim(), ID)
})

test('ไฟล์ลงทะเบียน native host ใน repo อนุญาต ID นี้', () => {
  const host = JSON.parse(read('native/com.phi1baht.bridge.json'))
  assert.deepEqual(host.allowed_origins, [`chrome-extension://${ID}/`])
})

test('ตัวติดตั้งคำนวณ ID จาก key ใน manifest เอง (ไฟล์ ID ค้างของเก่าก็ไม่พัง)', () => {
  const src = read('native/install.mjs').replace(/\r\n/g, '\n')
  assert.match(src, /const id = extensionIdFromKey\(/)
  assert.ok(!/^const id = readFileSync\(join\(DIR, 'extension-id\.txt'\)/m.test(src), 'ห้ามอ่าน ID จากไฟล์ตรงๆ')
})
