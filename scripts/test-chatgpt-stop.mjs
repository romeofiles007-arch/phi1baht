// เทสต์: ปุ่ม Stop ของ ChatGPT ที่ซ่อนอยู่ ห้ามนับว่า "ยังตอบไม่จบ"
//   node --test scripts/test-chatgpt-stop.mjs
// เจอจริง 23 พ.ย. 2026: คลิปแรกค้างที่ "แผนกคิดหัวข้อกำลังทำงาน" ทั้งที่ ChatGPT ตอบตารางหัวข้อครบแล้ว
// หน้า ChatGPT รุ่นใหม่เก็บปุ่ม aria-label="Stop" ขนาด 0×0 (มองไม่เห็น) ไว้ในช่องพิมพ์หลังตอบจบ
// pick(S.stop) เจอปุ่มนั้น → content script รอ "ตอบจบ" ไปจนหมดเวลา 30 นาที
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** element ปลอม: มองเห็นได้เมื่อมีขนาด */
const el = (label, { w = 0, h = 0 } = {}) => ({
  label,
  offsetWidth: w,
  offsetHeight: h,
  getClientRects: () => (w || h ? [{ width: w, height: h }] : []),
})

function loadSelectors(elementsBySelector) {
  const document = {
    querySelector: (sel) => (elementsBySelector[sel] ?? [])[0] ?? null,
    querySelectorAll: (sel) => elementsBySelector[sel] ?? [],
  }
  const ctx = vm.createContext({ document, globalThis: {} })
  vm.runInContext(`${read('extension/selectors.js')}\n;globalThis.__api = { SELECTORS, pick, pickVisible: typeof pickVisible === 'function' ? pickVisible : null }`, ctx)
  return ctx.globalThis.__api
}

const STOP_LABEL = 'button[aria-label*="Stop" i]'

test('ปุ่ม Stop ที่ซ่อนอยู่ (0×0) ไม่นับว่ายังตอบอยู่', () => {
  const api = loadSelectors({ [STOP_LABEL]: [el('Stop')] })
  assert.equal(typeof api.pickVisible, 'function', 'selectors.js ต้องมี pickVisible()')
  assert.equal(api.pickVisible(api.SELECTORS.chatgpt.stop), null)
})

test('ปุ่ม Stop ที่มองเห็นได้ยังนับว่ากำลังตอบ', () => {
  const visible = el('Stop', { w: 36, h: 36 })
  const api = loadSelectors({ [STOP_LABEL]: [el('Stop'), visible] })
  assert.equal(api.pickVisible(api.SELECTORS.chatgpt.stop), visible)
})

// เจอจริง 23 พ.ย. 2026 (ต่อ): หลัง ChatGPT เปลี่ยนหน้าจาก / เป็น /c/... มีช่องพิมพ์ซ่อนค้างอยู่อีกช่องก่อนช่องจริงใน DOM
// คำสั่งที่สองในแชตเดิม (ปรับความยาวบท) พิมพ์ลงช่องซ่อน → ช่องจริงไม่มีปุ่มส่ง → "ไม่เจอปุ่มส่ง"
test('ช่องพิมพ์และปุ่มส่งเลือกเฉพาะตัวที่มองเห็น (content script)', () => {
  const src = read('extension/content-chatgpt.js')
  assert.doesNotMatch(src, /\bpick\(S\.(input|send)\)/, 'ยังมี pick(S.input)/pick(S.send) ที่เลือกช่องซ่อนได้')
  assert.match(src, /pickVisible\(S\.input\)/)
  assert.match(src, /pickVisible\(S\.send\)/)
})

test('ช่องพิมพ์ที่ซ่อนอยู่ข้างหน้าไม่ถูกเลือก', () => {
  const hidden = el('Ask ChatGPT')
  const visible = el('Ask ChatGPT', { w: 600, h: 40 })
  const api = loadSelectors({ 'div[contenteditable="true"]': [hidden, visible] })
  assert.equal(api.pickVisible(api.SELECTORS.chatgpt.input), visible)
})

test('การวาง prompt จาก service worker เลือกช่องพิมพ์ที่มองเห็นเท่านั้น', () => {
  const src = read('extension/background.js')
  const paste = src.slice(src.indexOf("msg.type === 'CHATGPT_PASTE'"), src.indexOf("msg.type === 'ENSURE_APP'"))
  assert.doesNotMatch(paste, /selectors\.map\(\(s\) => document\.querySelector\(s\)\)/, 'ยังเลือกช่องพิมพ์ตัวแรกใน DOM (อาจเป็นช่องซ่อน)')
  assert.match(paste, /getClientRects|offsetWidth/)
})

test('content-chatgpt.js ตรวจปุ่ม Stop ด้วยตัวที่ดูการมองเห็นทุกจุด', () => {
  const src = read('extension/content-chatgpt.js')
  assert.doesNotMatch(src, /\bpick\(S\.stop\)/, 'ยังมี pick(S.stop) ที่นับปุ่มซ่อนอยู่')
  assert.match(src, /pickVisible\(S\.stop\)/)
})
