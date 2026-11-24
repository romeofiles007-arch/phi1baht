// รูปสินค้าจริงเป็นแบบให้ Flow วาด + ระดับความเด่นที่เลือกได้ + ให้ ChatGPT เลือกรูปและบรรยาย
//   node --test scripts/test-product-photo.mjs
// ผู้ใช้ 23 พ.ย. 2026: "ต้องดึงภาพจาก shopee มาใช้แนบในเรื่อง ตอนนี้ยัง try in ไม่แนบเนียน
// อยากให้สินค้าเด่นออกมาเลย และเหมือนด้วย โดยส่งให้ chatgpt เลือกว่าภาพไหนควรแนบและบรรยายด้วย
// เพราะบางทีอาจติดคนถือสินค้าใน shopee ไป"
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PROMINENCE, prominenceOf, DEFAULT_PROMINENCE, productRule, productPickPrompt, parseProductPick } from '../extension/prompts.js'
import { productShotRule, productFlowNote, pastable, flowAttachments } from '../pipeline/lib/prompts.mjs'
import { productAttachment } from '../pipeline/lib/product.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('ระดับความเด่นมี 3 แบบ · ค่าที่ไม่รู้จักกลับไปเป็นของใช้ในมือ', () => {
  assert.deepEqual(Object.keys(PROMINENCE), ['prop', 'hero', 'plot'])
  assert.equal(DEFAULT_PROMINENCE, 'prop')
  for (const id of Object.keys(PROMINENCE)) assert.equal(prominenceOf(id), id)
  for (const bad of ['', null, undefined, 'ฯลฯ']) assert.equal(prominenceOf(bad), 'prop')
  for (const level of Object.values(PROMINENCE)) {
    assert.ok(level.label && level.shots && level.rule, 'ทุกระดับต้องมีชื่อ จำนวนช็อต และกติกา')
  }
})

test('ทุกระดับความเด่นยังห้ามสินค้าเป็นของขลังหรือเป็นตัวเฉลยปม', () => {
  for (const id of Object.keys(PROMINENCE)) {
    const rule = productRule({ name: 'ไฟส่องกบ', enabled: true, prominence: id })
    assert.match(rule, /ห้ามให้สินค้าเป็นปมหรือตัวเฉลยของเรื่อง/, `${id}: ต้องห้ามเป็นปม`)
    assert.match(rule, /ห้ามพูดยี่ห้อ รุ่น ราคา โปรโมชัน/, `${id}: ต้องห้ามขายของ`)
    assert.ok(rule.includes(PROMINENCE[id].rule), `${id}: ต้องมีกติกาของระดับนี้`)
    assert.ok(rule.includes(PROMINENCE[id].label), `${id}: ต้องบอกระดับให้ผู้เขียนรู้`)
  }
  // ระดับ plot ให้สินค้าช่วยตัวละครได้ แต่ยังห้ามเป็นของวิเศษ
  assert.match(PROMINENCE.plot.rule, /ห้ามเป็นของขลังหรือของวิเศษ/)
  assert.match(PROMINENCE.hero.rule, /ไม่ใช่ภาพสินค้าวางบนพื้นขาวแบบโฆษณา/)
})

test('คำบรรยายหน้าตาสินค้าไปถึงทั้งคำสั่งเขียนบทและคำสั่งทำ Shot List', () => {
  const look = 'ไฟฉายคาดหัวตัวดำ หลอด LED กลม สายรัดสีส้ม'
  const product = { name: 'ไฟส่องกบ', enabled: true, prominence: 'hero', description: look }
  assert.ok(productRule(product).includes(look), 'บทต้องรู้หน้าตาสินค้า')
  assert.ok(productShotRule(product).includes(look), 'Shot List ต้องรู้หน้าตาสินค้า')
  assert.match(productShotRule(product), /มีช็อตเด่น 1 ช็อต/, 'ต้องบอกระดับความเด่น')
  assert.match(productShotRule(product), /ไม่ใช่รูปถ่ายแปะลงไป/)
  // ไม่ได้ตั้งสินค้า = ไม่มีอะไรไปถึง
  assert.equal(productShotRule(null), '')
  assert.equal(productRule({ name: 'x', enabled: false }), '')
})

test('บอก Flow เรื่องรูปสินค้าเฉพาะตอนมีรูปแนบจริง (กันพูดถึงรูปที่ไม่ได้แนบ)', () => {
  assert.equal(productFlowNote(null, 0), '', 'ไม่ได้ตั้งสินค้า = ไม่พูดถึงรูป')
  assert.equal(productFlowNote({ name: '' }, 0), '')
  // มีรูปในคลังหรือยังขึ้นกับเครื่องที่รันเทสต์ — เช็กทั้งสองทางโดยไม่ผูกกับสถานะเครื่อง
  const note = productFlowNote({ name: 'ไฟส่องกบ', description: 'ตัวดำ หลอดกลม' }, 2)
  if (productAttachment()) {
    assert.match(note, /รูปที่แนบลำดับที่ 3 \(ท้ายสุด\)/, 'ต้องบอกลำดับรูปให้ตรงกับที่แนบจริง')
    assert.match(note, /ห้ามวาดคน มือ พื้นหลังสตูดิโอ/)
    assert.match(note, /ตัวดำ หลอดกลม/, 'คำบรรยายต้องติดไปด้วย')
  } else {
    assert.equal(note, '', 'ไม่มีรูปในคลัง = ไม่พูดถึงรูป')
  }
})

test('คำสั่งให้ ChatGPT เลือกรูป: ห้ามรูปติดคน ติดตัวหนังสือ ติดหลายชิ้น', () => {
  const p = productPickPrompt({ name: 'ไฟส่องกบ', count: 6 })
  assert.match(p, /6 รูป/)
  assert.match(p, /ไม่มีคนหรือมือคนถืออยู่ในรูป/, 'ข้อที่ผู้ใช้เจอกับรูป Shopee')
  assert.match(p, /ไม่มีตัวหนังสือ ป้ายราคา สติกเกอร์โปรโมชัน/)
  assert.match(p, /ไม่ใช่ภาพรวมหลายชิ้น/)
  assert.match(p, /ห้ามพูดยี่ห้อ รุ่น ราคา สรรพคุณ/, 'คำบรรยายต้องไม่กลายเป็นคำโฆษณา')
  assert.match(p, /\{"pick": <เลขลำดับรูป 1-6>/, 'ต้องสั่งให้ตอบเป็น JSON')
})

test('อ่านคำตอบของ ChatGPT: รับเลขในช่วง · ปฏิเสธเลขเกิน และคำตอบที่ไม่ใช่ JSON', () => {
  const ok = parseProductPick('เลือกแล้วครับ {"pick": 3, "description": "ไฟฉายคาดหัวสีดำ", "warning": "รูปอื่นติดมือคน"}', 6)
  assert.deepEqual(ok, { pick: 3, description: 'ไฟฉายคาดหัวสีดำ', warning: 'รูปอื่นติดมือคน' })
  assert.equal(parseProductPick('{"pick": 7}', 6), null, 'เลขเกินจำนวนรูป')
  assert.equal(parseProductPick('{"pick": 0}', 6), null)
  assert.equal(parseProductPick('{"pick": "สาม"}', 6), null)
  assert.equal(parseProductPick('ขอรูปเพิ่มหน่อยครับ', 6), null, 'ถามกลับ = อ่านไม่ได้')
  assert.equal(parseProductPick('', 6), null)
  // ไม่ส่งจำนวนรูปมา = ไม่เช็กขอบบน
  assert.equal(parseProductPick('{"pick": 99, "description": "x"}').pick, 99)
})

test('ที่เก็บรูปสินค้า: แยกจากตั้งค่า และไม่ขึ้น git', async () => {
  const { PRODUCT_DIR, MAX_IMAGES, readProduct } = await import('../pipeline/lib/product.mjs')
  assert.match(PRODUCT_DIR, /characters[\\/]product$/, 'เก็บใต้ characters/ ซึ่ง .gitignore ครอบไว้แล้ว')
  assert.ok(MAX_IMAGES >= 6, 'Shopee มีรูปสินค้าหลายใบ ต้องเก็บได้พอ')
  // อ่านได้เสมอ ไม่ว่าเครื่องนี้จะเคยดึงรูปมาแล้วหรือยัง (เทสต์ต้องไม่ผูกกับสถานะเครื่อง)
  const { images, chosen, description } = readProduct()
  assert.ok(Array.isArray(images))
  assert.ok(chosen === null || images.includes(chosen), 'รูปที่เลือกต้องอยู่ในรายการเสมอ')
  assert.equal(typeof description, 'string')
  assert.ok(images.length <= MAX_IMAGES)
})

// ── รูปร่างของรูปแนบ ──
// 23 พ.ย. 2026: productAttachment() คืนแค่ { name, path } ไม่มี base64 ส่วนขยายจึงเรียก atob(undefined)
// แล้วโยน "Failed to execute 'atob' on 'Window'" ล้มทั้งรอบ — Flow สร้างภาพได้ 0/27
test('รูปสินค้าที่แนบให้ Flow มีรูปร่างเดียวกับรูปอื่น: name + type + base64 (ไม่ใช่ path)', () => {
  const a = productAttachment()
  if (!a) return // เครื่องนี้ยังไม่มีรูปสินค้า — ไม่มีอะไรให้ตรวจ
  assert.equal(typeof a.name, 'string')
  assert.match(a.type, /^image\/(png|jpeg|webp)$/, 'ต้องบอกชนิดไฟล์ ไม่งั้น File() ที่ส่วนขยายสร้างไม่มี type')
  assert.equal(typeof a.base64, 'string')
  assert.ok(a.base64.length > 0, 'ต้องส่งข้อมูลภาพไปด้วย ไม่ใช่ path ของไฟล์ในเครื่อง')
  assert.ok(!('path' in a), 'ห้ามส่ง path ของเครื่องออกไปให้ส่วนขยาย — มันใช้ไม่ได้และเคยทำให้เข้าใจผิดว่าแนบได้')
})

test('ทุกรูปที่ flowAttachments ส่งออกไป ส่วนขยายวางได้จริง (ไม่มีรูปที่ทำให้ atob พัง)', () => {
  for (const a of flowAttachments(null)) {
    assert.ok(a.name, 'รูปแนบต้องมีชื่อ')
    assert.ok(a.type, `${a.name}: ไม่มีชนิดไฟล์`)
    assert.equal(typeof a.base64, 'string', `${a.name}: base64 ไม่ใช่ข้อความ — atob จะโยน error แล้วล้มทั้งรอบ`)
    assert.ok(a.base64.length > 0, `${a.name}: ข้อมูลภาพว่าง`)
  }
})

test('ด่าน pastable ทิ้งรูปที่วางไม่ได้ ไม่ใช่ปล่อยไปล้มทั้งรอบ', () => {
  const good = { name: 'a.png', type: 'image/png', base64: 'AAAA' }
  assert.deepEqual(pastable([good, { name: 'b.png', type: 'image/png' }, { name: 'c.png', base64: 'AAAA' }, { base64: 'AAAA', type: 'image/png' }, null]), [good])
  assert.deepEqual(pastable([{ name: 'd.png', type: 'image/png', base64: '' }]), [], 'ข้อมูลภาพว่างก็วางไม่ได้')
  assert.deepEqual(pastable(null), [])
})

test('ส่วนขยาย: ทุกจุดที่เรียก atob กันไว้แล้ว ถ้าข้อมูลภาพหายต้องฟ้องชื่อไฟล์ ไม่ใช่ error ดิบของเบราว์เซอร์', () => {
  const agent = read('extension/content-flow-agent.js')
  assert.match(agent, /function attachmentFile\(a\)/)
  assert.match(agent, /ส่งมาไม่มีข้อมูลภาพ/, 'ต้องบอกชื่อรูปที่เสีย')
  assert.match(agent, /for \(const a of attachments\) dt\.items\.add\(attachmentFile\(a\)\)/, 'attachImages ต้องผ่านด่านนี้')
  // ไม่มี atob ที่ยังเรียกตรงๆ ในจุดแนบรูป (atob จุดอื่นของไฟล์นี้เป็นของ imageAsPngBase64 ที่ข้อมูลมาจากหน้าเอง)
  const common = read('extension/content-common.js')
  // ตัดจาก pasteFiles ถึงท้ายไฟล์ (ฟังก์ชันสุดท้ายก่อน export) — ไม่ผูกกับการเยื้องวงเล็บ
  const paste = common.slice(common.indexOf('function pasteFiles'))
  assert.ok(paste.startsWith('function pasteFiles'), 'ไม่พบ pasteFiles ใน content-common.js')
  assert.match(paste, /typeof a\?\.base64 !== 'string'/, 'pasteFiles ต้องข้ามรูปที่ไม่มีข้อมูลภาพ')
  assert.match(paste, /try \{/, 'atob ต้องอยู่ใน try')
})
