// รูปสินค้าแนบให้ Flow เฉพาะรูปที่เลือกแล้ว · ปกห้ามใช้รูปสินค้าเป็นแบบ
// ผู้ใช้ 24 พ.ย. 2026 (ส่งภาพหน้าแรกของคลิป "คืนที่ผีโพงลอยเหนือหลุมศพข้างถนนเปลี่ยว"): "หน้าแรกของ vdo เป็นแบบนี้"
//   หน้าแรกเป็นภาพโฆษณาขาตั้งไฟ "Metal Stand / Ring Light / Softbox" — ยังไม่ได้เลือกรูป ระบบแนบรูปแรกในคลังไปเอง
//   แล้ว Flow วาดรูปนั้นใหม่ทั้งใบเป็นภาพปก (768x1376 = ขนาดผลงานของ Flow ไม่ใช่ไฟล์ที่อัปโหลด)
//   node --test scripts/test-product-cover.mjs
import './helpers/temp-stores.mjs' // ต้องมาก่อน import อื่น — คลังของเทสต์อยู่ในโฟลเดอร์ชั่วคราว ไม่แตะคลังจริง
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const IMG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
const IMG2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function withStore(fn) {
  const mod = await import('../pipeline/lib/product.mjs')
  assert.ok(!/characters[\/](product|cast)$/.test(mod.PRODUCT_DIR), `เทสต์กำลังจะใช้คลังจริง: ${mod.PRODUCT_DIR}`)
  mod.clearProduct()
  try {
    return await fn(mod)
  } finally {
    mod.clearProduct()
  }
}

test('ยังไม่เลือกรูป = ไม่แนบรูปสินค้า (ไม่หยิบรูปแรกในคลังไปเอง) · เลือกแล้วจึงแนบ', async () => {
  const { loadConfig } = await import('../pipeline/lib/config.mjs')
  const setting = loadConfig().script?.product?.url ?? ''
  if (!setting) return // เครื่องนี้ไม่ได้ตั้งลิ้งสินค้า — productAttachment() ไม่มีทางแนบอยู่แล้ว
  await withStore((p) => {
    p.addProductImage({ type: 'image/png', base64: IMG1, source: 'shopee', sourceUrl: setting })
    p.addProductImage({ type: 'image/png', base64: IMG2, source: 'shopee', sourceUrl: setting })
    assert.ok(p.productMatches(setting))
    assert.equal(p.readProduct().chosen, null)
    assert.equal(p.productAttachment(), null, 'รูปแรกจาก Shopee มักเป็นภาพโฆษณามีตัวหนังสือ — ห้ามแนบเองโดยไม่มีใครเลือก')
    const [, second] = p.readProduct().images
    p.setProductPick({ chosen: second, by: 'user' })
    const a = p.productAttachment()
    assert.equal(a?.name, second, 'ต้องแนบรูปที่ผู้ใช้เลือก ไม่ใช่รูปแรก')
    assert.equal(a.picked, true)
  })
})

test('คำสั่ง Flow: ห้ามวาดรูปสินค้าใหม่ทั้งใบ · ปกห้ามใช้รูปสินค้าเป็นแบบ', () => {
  const src = readFileSync(new URL('../pipeline/lib/prompts.mjs', import.meta.url), 'utf8')
  const fn = src.slice(src.indexOf('export function productFlowNote'), src.indexOf('export function styleKitFlowNote'))
  assert.match(fn, /ห้ามวาดรูปนี้ใหม่ทั้งใบเป็นผลงานภาพไหนก็ตาม/)
  assert.match(fn, /ภาพปก \(COVER\) ห้ามใช้รูปนี้เป็นแบบ และไม่ต้องมีสินค้าชิ้นนี้ในปก/)
})

test('แผงข้างบอกตรงๆ ว่ายังไม่เลือก = ไม่แนบรูป (ไม่ใช่ "แนบรูปแรกไปก่อน")', () => {
  const panel = readFileSync(new URL('../extension/sidepanel.js', import.meta.url), 'utf8')
  assert.ok(!/แนบรูปแรกไปก่อน/.test(panel))
  assert.match(panel, /ยังไม่เลือก = ไม่แนบรูปให้ Flow \(วาดจากชื่ออย่างเดียว\)/)
  const lib = readFileSync(new URL('../pipeline/lib/product.mjs', import.meta.url), 'utf8')
  assert.ok(!/chosen \?\? images\[0\]/.test(lib), 'ห้ามกลับไปหยิบรูปแรกแทนรูปที่เลือก')
})
