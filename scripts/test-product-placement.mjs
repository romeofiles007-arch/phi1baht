// สินค้าในเรื่อง (ตัวทดลอง) — วางลิ้ง Shopee แล้วสินค้าโผล่เป็นของในมือ ไม่เป็นปมหรือทางออกของเรื่อง
//   node --test scripts/test-product-placement.mjs
// ผู้ใช้ (23 พ.ย. 2026): "ลองพิจารณา การ try in สินค้าเข้าไป เช่น แนบไฟส่องกบ ก็พยายามทำเนื้อเรื่องให้สินค้า
// เข้าไปอยู่ในเรื่อง โดยไม่ต้องมีบทบาทจนเสียเนื้อเรื่อง ทำเป็นตัวทดลองก่อน" + "แนบไปจากลิ้ง shoppee"
// ชื่อสินค้าอ่านจากตัวลิ้งเอง ไม่ยิงเน็ตไปหา Shopee (Shopee บล็อกการดึงข้อมูลและเปลี่ยนหน้าเว็บบ่อย)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { scriptPrompt, productFromUrl, productRule, CATEGORIES } from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const BLUEPRINT = read('extension/VDO Concept.txt')
const LIGHT = 'https://shopee.co.th/ไฟส่องกบ-LED-ชาร์จ-USB-กันน้ำ-ส่งฟรี-i.123456789.987654321'

test('อ่านชื่อสินค้าจากลิ้ง Shopee · ตัดคำโฆษณาทิ้ง', () => {
  assert.deepEqual(productFromUrl(LIGHT), { url: LIGHT, name: 'ไฟส่องกบ LED ชาร์จ USB กันน้ำ' })
  // คำโฆษณา (ส่งฟรี พร้อมส่ง ของแท้ ราคา %) ไม่ใช่ชื่อสินค้า — ห้ามหลุดไปเป็นคำที่ตัวละครเรียก
  assert.equal(productFromUrl('https://shopee.co.th/พร้อมส่ง-ของแท้-กระติกน้ำเก็บความเย็น-ลด50%-i.1.2').name, 'กระติกน้ำเก็บความเย็น')
  // 23 พ.ย. 2026 ของจริง: "GFShop-มี2สีให้เลือกกันไปเลย-🎉-พร้อมส่งทุกบ้าน-🚚-รองเท้าผ้าใบ"
  // เดิมได้ชื่อร้าน + คำโฆษณา แล้วชื่อสินค้าจริงโดนตัดทิ้งตอนครบ 60 ตัว
  const real = ['GFShop', 'มี2สีให้เลือกกันไปเลย', '🎉', 'พร้อมส่งทุกบ้าน', '🚚', 'รองเท้าผ้าใบผู้ชาย', 'ทรงสูง']
  assert.equal(productFromUrl(`https://shopee.co.th/${real.map(encodeURIComponent).join('-')}-i.1.2`).name, 'รองเท้าผ้าใบผู้ชาย ทรงสูง')
  // ชื่อร้านอังกฤษตัดทิ้งเฉพาะตอนมีคำไทยเหลือ — สินค้าอังกฤษล้วนตัดมั่วไม่ได้
  assert.match(productFromUrl('https://shopee.co.th/GFShop-LED-Headlamp-i.1.2').name, /LED Headlamp/)
  // มีแต่คำโฆษณา = ไม่มีชื่อ ให้ผู้ใช้พิมพ์เอง
  assert.equal(productFromUrl('https://shopee.co.th/พร้อมส่ง-ส่งฟรี-ลดราคา-i.1.2').name, null)
  // ชื่อยาวเกินไปตัดเหลือ 60 ตัว / 8 คำ — ชื่อสินค้า Shopee ยัด keyword ยาวเป็นพรืด
  assert.ok(productFromUrl(`https://shopee.co.th/${Array.from({ length: 20 }, (_, i) => `คำที่${i}`).join('-')}-i.1.2`).name.length <= 60)
})

test('ลิ้งที่ไม่มีชื่อสินค้าใน URL → ให้ผู้ใช้พิมพ์ชื่อเอง (ไม่เดา ไม่ยิงเน็ต)', () => {
  // ลิ้งย่อจากแอป Shopee และลิ้งแบบ /product/<shopId>/<itemId> ไม่มีชื่อสินค้าอยู่ข้างใน
  assert.deepEqual(productFromUrl('https://th.shp.ee/aBcDeF'), { url: 'https://th.shp.ee/aBcDeF', name: null })
  assert.equal(productFromUrl('https://shopee.co.th/product/123456789/987654321').name, null)
  // ไม่ใช่ลิ้ง Shopee หรือไม่ใช่ลิ้งเลย = ไม่รับ
  assert.equal(productFromUrl('https://lazada.co.th/ไฟส่องกบ-i.1.2'), null)
  assert.equal(productFromUrl('ไฟส่องกบ'), null)
  assert.equal(productFromUrl(''), null)
  assert.equal(productFromUrl(null), null)
})

test('กติกาสินค้า: เป็นของในมือ ห้ามเป็นปมหรือทางออก ห้ามขายของ', () => {
  const rule = productRule({ name: 'ไฟส่องกบ', enabled: true })
  assert.match(rule, /สินค้า: ไฟส่องกบ/)
  // 23 พ.ย. 2026: ความเด่นเลือกได้ 3 ระดับ ข้อความจึงเปลี่ยน แต่ข้อห้ามหลักต้องอยู่ครบทุกระดับ
  assert.match(rule, /\(ของใช้ในมือ\)/, 'ค่าเริ่มต้นยังเป็นของใช้ในมือ')
  assert.match(rule, /ห้ามให้สินค้าเป็นปมหรือตัวเฉลยของเรื่อง/)
  assert.match(rule, /ของขลัง|ตัวเรียกผี/, 'ห้ามกลายเป็นของขลัง/ตัวเรียกผี')
  assert.match(rule, /ลองลบสินค้าออกจากบท ถ้าปมกับคำเฉลยยังอยู่ครบ/, 'ต้องมีวิธีเช็กว่าสินค้าไม่กินเนื้อเรื่อง')
  assert.match(rule, /ห้ามพูดยี่ห้อ รุ่น ราคา โปรโมชัน/)
  assert.match(rule, /ห้ามชวนซื้อ/)
  assert.match(rule, /ห้ามบิดเนื้อเรื่องหรือเปลี่ยนยุคสมัยเพื่อให้สินค้าเข้า/)
  assert.match(rule, /ไม่เกิน 2 ครั้ง/, 'จำกัดจำนวนครั้งที่เรียกชื่อ')
  assert.match(rule, /ห้ามเป็นของต้องห้าม ของขลัง ของวิเศษ/)
  // ห้ามอยู่ในที่ที่จะพังจังหวะเรื่อง: บรรทัดเปิด ช่วงเฉลย ประโยคปิด ประโยคชวนคุย
  assert.match(rule, /ห้ามอยู่ในบรรทัดเปิดเรื่อง ในช่วงเฉลย ในประโยคปิดสอนใจ/)
})

test('ไม่ได้ตั้งสินค้า หรือปิดอยู่ = บทไม่รู้เรื่องสินค้าเลย', () => {
  assert.equal(productRule(null), '')
  assert.equal(productRule({ name: '', enabled: true }), '')
  assert.equal(productRule({ name: 'ไฟส่องกบ', enabled: false }), '', 'ปิดอยู่ต้องไม่ส่งไปใน prompt')
  const plain = scriptPrompt(BLUEPRINT, 'คืนที่นางตะเคียนร้องไห้', { language: 'th', targetMinutes: 1, profile: { category: 'ghost', scare: 'medium' }, engage: false })
  assert.ok(!/สินค้า/.test(plain), 'คลิปที่ไม่ได้ตั้งสินค้าต้องไม่มีคำว่าสินค้าในคำสั่งเลย')
})

for (const c of CATEGORIES) {
  test(`คำสั่งเขียนบท (${c.id}): สินค้าที่ตั้งไว้ไปอยู่ในคำสั่ง`, () => {
    const prompt = scriptPrompt(BLUEPRINT, 'คืนที่คนหาปลาไม่กลับจากหนอง', {
      language: 'th', targetMinutes: 1, profile: { category: c.id, scare: 'medium' }, engage: false, product: { name: 'ไฟส่องกบ', enabled: true },
    })
    assert.ok(prompt.includes(productRule({ name: 'ไฟส่องกบ', enabled: true })), 'ต้องมีกติกาสินค้าเต็มฉบับ')
  })
}

test('ภาพ: สินค้าโผล่ 2–3 ช็อตเป็นของในมือ · ห้ามโคลสอัปโฆษณา · ห้ามตัวหนังสือบนตัวสินค้า', async () => {
  const { productShotRule } = await import('../pipeline/lib/prompts.mjs')
  assert.equal(productShotRule(null), '')
  assert.equal(productShotRule({ name: '' }), '')
  const rule = productShotRule({ name: 'ไฟส่องกบ' })
  assert.match(rule, /"ไฟส่องกบ"/)
  assert.match(rule, /2–3 ช็อต/)
  assert.match(rule, /ห้ามเป็นจุดสนใจของช็อต/, 'ระดับเริ่มต้น: สินค้าต้องไม่แย่งความสนใจ')
  // Blueprint กฎ 7: ภาพในเรื่องไม่มีตัวหนังสือ — โลโก้ยี่ห้อก็ห้าม
  assert.match(rule, /ห้ามมีตัวหนังสือ โลโก้ ยี่ห้อ/)
})

// ภาพของคลิปจริงมาจาก nextRoundPrompt (ขอ shot ทีละรอบ) ไม่ใช่ shotlistPrompt ก้อนเดียว
// ใส่กติกาสินค้าแต่ใน shotlistPrompt จะทำให้สินค้าไม่เคยถูกวาดเลยตอนทำคลิปอัตโนมัติ
test('ภาพ: กติกาสินค้าไปถึงทั้ง 2 ทางที่ขอ prompt ภาพ (รอบแรกที่มี Bible และรอบถัดไป)', () => {
  const src = read('pipeline/lib/shotlist.mjs')
  assert.equal(src.match(/productShotRule\(clipProduct\(config\)\)/g)?.length, 4, 'ต้องใส่ทั้งรอบแรกและรอบถัดไป')
  assert.match(read('pipeline/lib/prompts.mjs'), /productShotRule\(clipProduct\(config\)\)/)
})

test('config: สินค้าปิดไว้เป็นค่าเริ่มต้น และ build ของลูกค้าไม่ติดลิ้งร้านของเราไป', () => {
  const def = JSON.parse(read('config/default.config.json'))
  assert.deepEqual(def.script.product, { url: '', name: '', enabled: false })
  assert.match(read('scripts/make-default-config.mjs'), /config\.script\.product = \{ url: '', name: '', enabled: false \}/)
})

test('แผงข้าง: มีช่องวางลิ้ง ช่องชื่อ สวิตช์เปิดใช้ และปุ่มล้าง · ส่งสินค้าไปตอนเปิดใช้เท่านั้น', () => {
  const html = read('extension/sidepanel.html')
  for (const id of ['clipProductUrl', 'clipProductName', 'clipProductEnabled', 'clipProductClear', 'clipProductHint']) {
    assert.ok(html.includes(`id="${id}"`), `แผงข้างต้องมี #${id}`)
  }
  const js = read('extension/sidepanel.js')
  assert.match(js, /product: clip\?\.product\?\.enabled && clip\.product\.name \? clip\.product : null/)
  // โปรแกรมในเครื่องรุ่นเก่าไม่ส่ง product มา → ซ่อนกล่อง ไม่ใช่พัง
  assert.match(js, /box\.hidden = !p/)
  // bridge เก็บลงตั้งค่าของโปรแกรมในเครื่อง และคืนค่ากลับให้แผงข้าง
  const ui = read('bridge/ui.js')
  assert.match(ui, /body\.productUrl/)
  assert.match(ui, /enabled: c\.script\.product\?\.enabled === true && Boolean\(c\.script\.product\?\.name\)/)
})
