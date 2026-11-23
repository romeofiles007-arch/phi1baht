// Flow ขึ้น error ค้างอยู่ → ต้องรู้ตัวก่อนแนบรูปและก่อนวาง prompt ไม่ใช่รายงานว่า "วาง prompt ไม่ได้"
//   node --test scripts/test-flow-error-check.mjs
// 23 พ.ย. 2026 ผู้ใช้ส่งภาพหน้า Flow ที่ขึ้น toast "Something went wrong. Please try again."
// พร้อม prompt และรูปแนบ 4 ใบค้างในช่องพิมพ์ แล้วถามว่า "แนบไปแบบนี้ไม่มีตรวจหรอ"
//   log จริง: RUN ERROR › Flow รอบนี้มีปัญหา: [extension 0.1.0] วาง prompt ลงช่องพิมพ์ของ Flow ไม่ได้
// ต้นเหตุ: ช่องพิมพ์ล้างไม่ออกเพราะ Flow ค้าง error → pasteText() คืน false ครบ 3 รอบ → โยน error สาเหตุผิด
// และข้ามตรรกะ FLOW_BUSY (รอเป็นนาทีแล้วส่งใหม่) ไปเลย ทั้งที่ของเดิมมีอยู่แล้วแต่ตรวจหลังส่งเท่านั้น
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const src = (p) => readFileSync(new URL(`../extension/${p}`, import.meta.url), 'utf8')
const AGENT = src('content-flow-agent.js')

class KeyboardEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init) }
}
const ctx = vm.createContext({ KeyboardEvent })
vm.runInContext(src('flow-text.js'), ctx)
const { agentFailureKind } = ctx.CartoonFlowText

test('ข้อความ toast จริงของ Flow ถูกจัดเป็น "ผิดพลาด" (รอแล้วส่งใหม่ ไม่ใช่หยุดทั้งชุด)', () => {
  assert.equal(agentFailureKind('Something went wrong. Please try again.'), 'failed')
  assert.equal(agentFailureKind('เกิดข้อผิดพลาด โปรดลองอีกครั้ง'), 'failed')
  // คิวเต็ม = รอได้ · กันบอต = ต้องหยุดทั้งชุด
  assert.equal(agentFailureKind('We are experiencing high demand'), 'busy')
  assert.equal(agentFailureKind('We noticed some unusual activity'), 'blocked')
  assert.equal(agentFailureKind(''), '')
})

test('ตรวจ error ของ Flow ก่อนแนบรูป — ไม่แนบทับแล้วค่อยไปตายตอนวาง prompt', () => {
  const before = AGENT.split('await attachImages(')[0]
  assert.ok(before.includes('const stuck = flowProblem()'), 'ต้องเรียก flowProblem() ก่อน attachImages')
  assert.ok(before.includes('if (stuck) throw flowFailureError(stuck)'))
})

test('วาง prompt ไม่สำเร็จ → รายงานสาเหตุจริงของ Flow ก่อน แล้วค่อยบอกว่าวางไม่ได้', () => {
  const branch = AGENT.split('if (!pasted) {')[1].split('\n    }')[0]
  assert.match(branch, /const why = flowProblem\(\)/)
  assert.match(branch, /if \(why\) throw flowFailureError\(why\)/)
  const generic = branch.indexOf('วาง prompt ลงช่องพิมพ์ของ Flow ไม่ได้')
  assert.ok(generic > branch.indexOf('flowFailureError(why)'), 'ข้อความทั่วไปต้องอยู่หลังการตรวจสาเหตุจริง')
  assert.match(branch, /เปิดแท็บ Flow ดูว่ามีอะไรค้างในช่องพิมพ์/, 'บอกผู้ใช้ด้วยว่าต้องไปดูตรงไหน')
})

test('flowProblem: นับเฉพาะข้อความที่บอกว่าเกิดข้อผิดพลาด ไม่ใช่แถบเตือนอะไรก็ได้', () => {
  const fn = AGENT.split('const flowProblem = ')[1].split('\n}')[0]
  assert.match(fn, /agentFailed\(\)/, 'ดูการ์ดคำตอบของ Agent')
  assert.match(fn, /pageAlerts\(\)/, 'ดู toast\/แถบเตือนบนหน้าด้วย — toast ของ Flow ไม่ใช่การ์ดคำตอบ')
  assert.match(fn, /if \(!card && !L\.agentFailed\.test\(alerts\)\) return ''/, 'แถบเตือนอื่นต้องไม่ทำให้สั่งงานไม่ได้')
  // toast ของ Flow เป็น snackbar — pageAlerts ต้องกวาดถึง
  assert.match(AGENT, /mat-snack-bar-container/)
})

test('การจัดประเภท busy/blocked เหลือที่เดียว — ไม่มีก้อนเดิมซ้ำสองที่', () => {
  // (ข้อความ "ไม่รับคำสั่งของ Agent มา N นาทีแล้ว" ตอนรอนานเกินเป็นคนละอัน ไม่นับ)
  assert.equal(AGENT.match(/FLOW_BLOCKED: Google Flow ไม่รับคำสั่งของ Agent — "/g)?.length, 1)
  assert.equal(AGENT.match(/FLOW_BUSY: Flow \$\{kind/g)?.length, 1)
  assert.ok(!/let kind = ''/.test(AGENT), 'ตัวแปร kind ที่ไม่ได้ใช้แล้วต้องไม่เหลือ')
  // ทางที่โยน error ของ Flow ทุกทางต้องผ่านตัวแปลงเดียวกัน
  assert.equal(AGENT.match(/flowFailureError\(/g)?.length, 3, 'เรียก 3 ที่: ก่อนแนบรูป · วาง prompt ไม่ได้ · หลังส่ง')
  assert.match(AGENT, /const flowFailureError = \(why\) =>/, 'ตัวแปลงต้องมีที่เดียว')
})
