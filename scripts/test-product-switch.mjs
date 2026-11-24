// เปลี่ยนสินค้าแล้วรูปเก่าต้องไม่ค้าง — ผู้ใช้ 23 พ.ย. 2026 (ส่งภาพแผงข้าง): "ภาพเดิมมันค้างอยู่ ไม่รู้ว่ามีผลไหม"
//
// มีผล: ลิ้งเปลี่ยนเป็นนาฬิกาแล้ว แต่คลังยังเป็นรูปรองเท้า 8 ใบ + รูปที่ ChatGPT เลือก + คำบรรยายรองเท้า
//   → บทเขียนว่า "นาฬิกา" แต่บอกหน้าตาเป็นรองเท้า · Flow ได้รูปรองเท้าแนบไปเป็นแบบ
// ซ้อนกันอีก 2 เรื่อง: 8 ใบนั้นเป็นคู่ซ้ำทุกไบต์ 4 คู่ (คลังเต็มจนรับรูปนาฬิกาไม่ได้)
//   และมี 2 ใบเป็นกรอบโปรโมชันโปร่งใสของ Shopee ("ส่งฟรี · ส่วนลด") ไม่ใช่รูปสินค้า
//   node --test scripts/test-product-switch.mjs
import './helpers/temp-stores.mjs' // ต้องมาก่อน import อื่น — คลังของเทสต์อยู่ในโฟลเดอร์ชั่วคราว ไม่แตะคลังจริง
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, cpSync, rmSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const A = 'https://shopee.co.th/%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B9%89%E0%B8%B2-i.111.222?sp_atk=abc'
const A_OTHER_PARAMS = 'https://shopee.co.th/%E0%B8%A3%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%97%E0%B9%89%E0%B8%B2-i.111.222?xptdk=zzz'
const B = 'https://shopee.co.th/%E0%B8%99%E0%B8%B2%E0%B8%AC%E0%B8%B4%E0%B8%81%E0%B8%B2-i.333.444'
// รูป PNG 1x1 สองใบที่เนื้อไฟล์ต่างกัน
const IMG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
const IMG2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

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

test('ตัวตนสินค้าจากลิ้ง: สินค้าเดียวกันต่างแค่พารามิเตอร์ = ตัวเดียวกัน · คนละสินค้า = คนละตัว', async () => {
  const { productKey } = await import('../pipeline/lib/product.mjs')
  assert.equal(productKey(A), '111.222')
  assert.equal(productKey(A), productKey(A_OTHER_PARAMS), 'พารามิเตอร์ติดตามต่างกันต้องไม่ทำให้คิดว่าเป็นสินค้าใหม่')
  assert.equal(productKey('https://shopee.co.th/product/111/222'), '111.222', 'ลิ้งแบบ /product/<ร้าน>/<สินค้า> ก็ต้องอ่านได้')
  assert.notEqual(productKey(A), productKey(B))
  assert.equal(productKey(''), '')
  assert.equal(productKey(null), '')
})

test('รูปของสินค้าตัวใหม่เข้ามา → ล้างรูปของตัวเก่าก่อน ไม่ให้ปนกันหรือเต็มคลัง', async () => {
  await withStore((p) => {
    p.addProductImage({ type: 'image/png', base64: IMG1, source: 'shopee', sourceUrl: A })
    p.addProductImage({ type: 'image/png', base64: IMG2, source: 'shopee', sourceUrl: A })
    p.setProductPick({ chosen: p.readProduct().images[0], description: 'รองเท้าผ้าใบสีดำ' })
    assert.equal(p.readProduct().images.length, 2)
    assert.ok(p.productMatches(A))
    assert.ok(!p.productMatches(B))

    // ลิ้งเดิมแต่พารามิเตอร์ต่าง = สินค้าเดิม ไม่ล้าง
    p.addProductImage({ type: 'image/png', base64: IMG1, source: 'shopee', sourceUrl: A_OTHER_PARAMS })
    assert.equal(p.readProduct().images.length, 2, 'สินค้าเดิมต้องไม่ถูกล้าง')

    // สินค้าตัวใหม่
    p.addProductImage({ type: 'image/png', base64: IMG2, source: 'shopee', sourceUrl: B })
    const after = p.readProduct()
    assert.equal(after.images.length, 1, 'รูปของสินค้าตัวเก่าต้องหายไปทั้งหมด')
    assert.equal(after.chosen, null, 'รูปที่ ChatGPT เลือกของตัวเก่าต้องหายไป')
    assert.equal(after.description, '', 'คำบรรยายของตัวเก่าต้องหายไป — ไม่งั้นบทบอกหน้าตาผิดสินค้า')
    assert.equal(after.sourceUrl, B)
    assert.ok(p.productMatches(B))
  })
})

test('ไฟล์ซ้ำทุกไบต์ไม่ถูกเพิ่ม (Shopee มีรูปเดียวกันหลาย URL — เคยได้ 8 ใบที่เป็นคู่ซ้ำ 4 คู่)', async () => {
  await withStore((p) => {
    p.addProductImage({ type: 'image/png', base64: IMG1, source: 'shopee', sourceUrl: A })
    p.addProductImage({ type: 'image/png', base64: IMG1, source: 'shopee', sourceUrl: A })
    p.addProductImage({ type: 'image/png', base64: IMG1, source: 'shopee', sourceUrl: A })
    assert.equal(p.readProduct().images.length, 1)
    assert.equal(readdirSync(p.PRODUCT_DIR).filter((f) => f.endsWith('.png')).length, 1, 'ต้องไม่เขียนไฟล์ซ้ำลงดิสก์ด้วย')
  })
})

test('คลังรุ่นเก่า (ไม่รู้ว่าเป็นรูปของสินค้าไหน) = ไม่แนบ ไม่ใช้คำบรรยาย จนกว่าจะดึงใหม่', async () => {
  await withStore(async (p) => {
    const { clipProduct } = await import('../pipeline/lib/prompts.mjs')
    const { loadConfig } = await import('../pipeline/lib/config.mjs')
    const setting = loadConfig().script?.product?.url ?? ''
    // จำลองคลังแบบที่ค้างอยู่ในเครื่องผู้ใช้: มีรูป มีรูปที่เลือก มีคำบรรยาย แต่ไม่มี sourceUrl
    p.addProductImage({ type: 'image/png', base64: IMG1, source: 'shopee', sourceUrl: A })
    const file = join(p.PRODUCT_DIR, 'product.json')
    const legacy = JSON.parse(readFileSync(file, 'utf8'))
    delete legacy.sourceUrl
    writeFileSync(file, JSON.stringify({ ...legacy, chosen: legacy.images[0], description: 'รองเท้าผ้าใบสีดำ' }))
    assert.equal(p.productMatches(setting), false, 'ไม่รู้ว่าเป็นของใคร = ถือว่าไม่ตรง')
    assert.equal(p.productAttachment(), null, 'ห้ามแนบรูปที่อาจเป็นของสินค้าตัวอื่นให้ Flow')
    const c = clipProduct()
    if (c) {
      assert.equal(c.description, '', 'ห้ามเอาคำบรรยายที่อาจเป็นของสินค้าตัวอื่นเข้าบท')
      assert.equal(c.photo, null)
    }
    // ดึงรูปของสินค้าที่ตั้งไว้ตอนนี้ → ใช้ได้ตามปกติ
    if (setting) {
      p.addProductImage({ type: 'image/png', base64: IMG2, source: 'shopee', sourceUrl: setting })
      assert.ok(p.productMatches(setting))
      p.setProductPick({ chosen: p.readProduct().images[0], by: 'user' })
      assert.ok(p.productAttachment(), 'รูปของสินค้าที่ตั้งไว้ (และเลือกแล้ว) ต้องแนบได้')
    }
  })
})

test('โปรแกรมในเครื่อง: เปลี่ยนลิ้งเป็นสินค้าตัวอื่น = ล้างคลังรูป · บอกแผงข้างเมื่อรูปไม่ตรงสินค้า', () => {
  const ui = read('bridge/ui.js')
  const block = ui.slice(ui.indexOf('if (body.productUrl !== undefined) {'), ui.indexOf('if (body.productName !== undefined)'))
  assert.match(block, /const before = p\.url/)
  assert.match(block, /if \(productKey\(before\) !== productKey\(p\.url\)\) clearProduct\(\)/)
  const view = ui.slice(ui.indexOf("if (path === '/api/product' ||"), ui.indexOf("if (req.method === 'GET' && path === '/api/product')"))
  assert.match(view, /stale: p\.images\.length > 0 && !productMatches\(\)/)
})

test('แผงข้าง: ดึงรูปแล้วบอกว่าเป็นของสินค้าไหน · เตือนเมื่อรูปในคลังเป็นของตัวเก่า', () => {
  const panel = read('extension/sidepanel.js')
  assert.match(panel, /productCall\('\/api\/product\/image', \{ \.\.\.img, source: 'shopee', sourceUrl: clip\?\.product\?\.url \}\)/)
  assert.match(panel, /p\.stale\s*\n?[\s\S]{0,200}รูปเหล่านี้เป็นของสินค้าตัวเก่า/)
  assert.match(panel, /p\.stale \? ' err'/, 'คำเตือนต้องเป็นสีแดง ไม่ใช่สีเขียวแบบ "แนบแล้ว"')
})

test('ตัวดึงรูป Shopee: ทิ้งกรอบโปรโมชันโปร่งใส และทิ้งไฟล์ที่ซ้ำกันทุกไบต์', () => {
  const shopee = read('extension/content-shopee.js')
  assert.match(shopee, /async function mostlyTransparent\(blob\)/)
  assert.match(shopee, /px\[i\] < 40/, 'นับพิกเซลที่โปร่งใส')
  assert.match(shopee, /> 0\.4/, 'โปร่งใสเกือบครึ่งใบ = กรอบ ไม่ใช่รูปสินค้า')
  assert.match(shopee, /if \(await mostlyTransparent\(blob\)\) return null/)
  assert.match(shopee, /crypto\.subtle\.digest\('SHA-1'/)
  assert.match(shopee, /if \(!img \|\| seenHash\.has\(img\.hash\)\) continue/)
  // ส่งไปโปรแกรมในเครื่องแค่ชนิดกับเนื้อรูป ไม่ต้องแบกลายนิ้วมือไปด้วย
  assert.match(shopee, /images\.push\(\{ type: img\.type, base64: img\.base64 \}\)/)
})
