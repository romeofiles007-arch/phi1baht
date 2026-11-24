// รูปสินค้า: ไม่ส่งให้ AI เอง · ส่งไปตามผู้เขียนที่เลือก · เลือกรูปอ้างอิงเองได้
// ผู้ใช้ 23 พ.ย. 2026: "ถ้าเราไม่สั่งให้ส่งไป ChatGPT ก็ยังไม่ต้องส่งไป ถ้าเราจะให้ ChatGPT สร้างก็ส่งไป ChatGPT
// แต่ถ้าเราเลือก Gemini ก็ส่งไป Gemini แล้วเราสามารถที่จะเลือกรูปภาพที่เราต้องการจะให้อัปโหลดไปเพื่อเป็น reference ได้เองด้วย"
//   node --test scripts/test-product-vision.mjs
import './helpers/temp-stores.mjs' // ต้องมาก่อน import อื่น — คลังของเทสต์อยู่ในโฟลเดอร์ชั่วคราว ไม่แตะคลังจริง
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { productDescribePrompt, productPickPrompt, parseProductPick } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const PANEL = read('extension/sidepanel.js')
const IMG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
const IMG2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const URL_A = 'https://shopee.co.th/x-i.111.222'

/** คลังของเทสต์อยู่ในโฟลเดอร์ชั่วคราว (helpers/temp-stores.mjs) — ล้างก่อนและหลังทุกเทสต์ · ห้ามเป็นคลังจริง */
async function withStore(fn) {
  const mod = await import('../pipeline/lib/product.mjs')
  assert.ok(!/characters[\\/](product|cast)$/.test(mod.PRODUCT_DIR), `เทสต์กำลังจะใช้คลังจริง: ${mod.PRODUCT_DIR}`)
  mod.clearProduct()
  try {
    return await fn(mod)
  } finally {
    mod.clearProduct()
  }
}

test('ดึงรูปเสร็จแล้วไม่ส่งให้ AI เอง', () => {
  const fetchFn = /async function fetchProductPhotos[\s\S]*?\n\}/.exec(PANEL)[0]
  assert.ok(!/pickProductPhoto\(/.test(fetchFn), 'ห้ามเรียก AI เองหลังดึงรูป')
  assert.ok(!/pickProductPhoto\(\{ auto/.test(PANEL), 'ห้ามเหลือทางเรียก AI แบบอัตโนมัติที่อื่น')
})

test('ส่งไปตามผู้เขียนที่เลือก: ChatGPT · Gemini เว็บ · Gemini API', () => {
  const fn = PANEL.slice(PANEL.indexOf('function visionWriter()'), PANEL.indexOf('/** แท็บ Gemini'))
  assert.match(fn, /clip\?\.writer === 'gemini-web'\) return \{ id: 'gemini-web', label: 'Gemini' \}/)
  assert.match(fn, /clip\?\.writer === 'gemini'\) return \{ id: 'gemini', label: 'Gemini API' \}/)
  assert.match(fn, /return \{ id: 'chatgpt', label: 'ChatGPT' \}/, 'ค่าเริ่มต้นยังเป็น ChatGPT')
  const ask = PANEL.slice(PANEL.indexOf('async function askVision'), PANEL.indexOf('/** รูปที่ผู้ใช้กดเลือกเอง'))
  assert.match(ask, /w\.id === 'gemini'\) return \(await api\(await localApp\(\), '\/api\/product\/ask-gemini'/, 'Gemini API ถามผ่านโปรแกรมในเครื่อง (key ไม่อยู่ในแผงข้าง)')
  assert.match(ask, /w\.id === 'gemini-web' \? askGeminiWeb\(prompt, attachments\) : askChatGPT\(prompt, attachments\)/)
  // ชื่อปุ่มและข้อความเปลี่ยนตามผู้เขียน ไม่ได้ติดคำว่า ChatGPT ตายตัว
  assert.match(PANEL, /`✨ ให้ \$\{w\.label\} เลือกรูป`/)
  const pick = PANEL.slice(PANEL.indexOf('async function pickProductPhoto'), PANEL.indexOf('/** กดที่รูป = ใช้รูปนี้'))
  assert.ok(!/askChatGPT\(/.test(pick), 'ตัวเลือกรูปห้ามเรียก ChatGPT ตรงๆ — ต้องผ่าน askVision')
})

test('แท็บ Gemini เว็บรับคำถามที่มีรูปแนบจากแผงข้างได้', () => {
  const g = read('extension/content-gemini.js')
  assert.match(g, /if \(msg\.type === 'ASK'\) \{/)
  assert.match(g, /runPrompt\(msg\.prompt, \{ newChat: msg\.newChat \?\? true, images: msg\.attachments \?\? \[\] \}\)/)
  assert.match(g, /async function fillPrompt\(prompt, images = \[\]\)/)
  assert.match(g, /Gemini รับรูปแนบ/, 'ต้องรอให้รูปขึ้นเป็นไฟล์แนบก่อนพิมพ์')
  assert.match(g, /typeof img\?\.base64 !== 'string' \|\| !img\.base64\) continue/, 'รูปที่ไม่มีข้อมูลต้องข้าม ไม่ให้ atob พัง')
  // แผงข้างฉีดสคริปต์เองถ้าแท็บเปิดค้างก่อนรีโหลดส่วนขยาย
  assert.match(PANEL, /files: \['content-common\.js', 'content-gemini\.js'\]/)
})

test('Gemini API: แนบรูปไปกับคำถามได้ · โปรแกรมในเครื่องอ่านรูปจากคลังตามชื่อ', () => {
  const t = read('pipeline/lib/gemini_text.mjs')
  assert.match(t, /images = \[\] \} = \{\}\) \{/)
  assert.match(t, /inline_data: \{ mime_type: i\.type, data: i\.base64 \}/)
  assert.match(t, /parts: \[\.\.\.pictures, \{ text: prompt \}\]/)
  const ui = read('bridge/ui.js')
  const route = ui.slice(ui.indexOf("path === '/api/product/ask-gemini'"), ui.indexOf("path === '/api/product/clear'"))
  assert.match(route, /\.filter\(\(n\) => images\.includes\(n\)\)/, 'ส่งได้เฉพาะรูปที่อยู่ในคลัง ไม่ให้อ่านไฟล์อื่นในเครื่อง')
  assert.match(route, /geminiChat\(\{ log \}\)\.ask\(String\(prompt \?\? ''\), \{ images: pics/)
})

test('กดที่รูป = เลือกเป็นแบบเอง · AI ไม่เลือกทับ ทำได้แค่บรรยาย', async () => {
  await withStore((p) => {
    p.addProductImage({ type: 'image/png', base64: IMG1, source: 'shopee', sourceUrl: URL_A })
    p.addProductImage({ type: 'image/png', base64: IMG2, source: 'shopee', sourceUrl: URL_A })
    const [first, second] = p.readProduct().images
    // ผู้ใช้กดเลือกรูปที่ 2 เอง
    p.setProductPick({ chosen: second, by: 'user' })
    assert.equal(p.readProduct().chosen, second)
    assert.equal(p.readProduct().pickedBy, 'user')
    // AI บรรยาย (แผงข้างส่งมาโดยไม่มี chosen) → รูปเดิมต้องอยู่ และยังนับว่าผู้ใช้เลือก
    p.setProductPick({ description: 'นาฬิกาข้อมือสายสแตนเลส หน้าปัดดำ' })
    const after = p.readProduct()
    assert.equal(after.chosen, second, 'AI ห้ามเปลี่ยนรูปที่ผู้ใช้เลือก')
    assert.equal(after.pickedBy, 'user')
    assert.equal(after.description, 'นาฬิกาข้อมือสายสแตนเลส หน้าปัดดำ')
    // ให้ AI เลือกเอง → บันทึกว่า AI เลือก
    p.setProductPick({ chosen: first, description: 'x', by: 'ai' })
    assert.equal(p.readProduct().pickedBy, 'ai')
    // คลังรุ่นก่อนที่ไม่มี pickedBy แต่มีรูปที่เลือก = ถือว่า AI เลือก (เดิมมีแต่ทางนั้น)
    assert.equal(p.readProduct().pickedBy, 'ai')
  })
  const pick = PANEL.slice(PANEL.indexOf('async function pickProductPhoto'), PANEL.indexOf('/** กดที่รูป = ใช้รูปนี้'))
  assert.match(pick, /const only = userPickedPhoto\(\) \?\? \(photos\.length === 1 \? photos\[0\] : null\)/)
  assert.match(pick, /productDescribePrompt\(/, 'รูปที่เลือกเองแล้วส่งไปให้บรรยายอย่างเดียว')
  assert.match(pick, /productCall\('\/api\/product\/pick', \{ description: result\.description \}\)/, 'บันทึกแค่คำบรรยาย ไม่ส่งรูปใหม่ทับ')
  const choose = PANEL.slice(PANEL.indexOf('async function chooseProductPhoto'))
  assert.match(choose.slice(0, 400), /productCall\('\/api\/product\/pick', \{ chosen: name, by: 'user' \}\)/)
  assert.match(PANEL, /img\.addEventListener\('click', \(\) => !photo\.picked && chooseProductPhoto\(photo\.name\)\)/)
  assert.match(read('extension/sidepanel.html'), /#productThumbs li\.picked img \{ outline/, 'ต้องเห็นว่ารูปไหนคือแบบ')
  assert.match(read('bridge/ui.js'), /setProductPick\(\{ chosen: chosen \? String\(chosen\) : null, description, by \}\)/)
})

test('คำสั่งบรรยายอย่างเดียว: บอกว่าผู้ใช้เลือกแล้ว ไม่ต้องเลือกใหม่ · ตอบรูปแบบที่ตัวอ่านเดิมอ่านได้', () => {
  const d = productDescribePrompt({ name: 'นาฬิกา', language: 'th' })
  assert.match(d, /ผู้ใช้เลือกรูปนี้เป็นแบบให้ AI วาดการ์ตูนแล้ว ไม่ต้องเลือกรูปใหม่/)
  assert.match(d, /ห้ามพูดยี่ห้อ รุ่น ราคา สรรพคุณ/)
  assert.match(d, /\{"pick": 1, "description": "\.\.\.", "warning": ""\}/)
  assert.deepEqual(parseProductPick('{"pick": 1, "description": "นาฬิกาหน้าปัดดำ", "warning": ""}', 1), { pick: 1, description: 'นาฬิกาหน้าปัดดำ', warning: '' })
  // คำสั่งเลือกรูปแบบเดิมยังอยู่สำหรับตอนให้ AI เลือกจากหลายรูป
  assert.match(productPickPrompt({ name: 'นาฬิกา', count: 4 }), /4 รูป/)
})
