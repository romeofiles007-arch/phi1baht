/**
 * สินค้าที่ขอให้โผล่ในเรื่อง — รูปและคำบรรยายที่ใช้เป็นแบบให้ Flow วาดสินค้าให้เหมือนของจริง
 *
 * แบ่งที่เก็บเป็น 2 ส่วนตามอายุของข้อมูล:
 *   config.script.product   ตั้งค่าที่ผู้ใช้กรอก (url · name · enabled · prominence) — อยู่ใน config ของเครื่อง
 *   characters/product/     ของที่ได้มา (รูปสินค้า + รูปที่ ChatGPT เลือก + คำบรรยาย) — ไม่ขึ้น git
 *     product.json   { images: [ชื่อไฟล์], chosen: ชื่อไฟล์|null, description, pickedAt }
 *     <รูป>.png|jpg|webp
 *
 * ทำไมต้องให้ ChatGPT เลือกรูป: รูปใน Shopee มักติดมือคนถือ ติดพื้นหลังสตูดิโอ หรือมีตัวหนังสือโปรโมชัน
 * ทับอยู่ ถ้าแนบรูปแบบนั้นให้ Flow มันจะวาดมือคนหรือตัวหนังสือติดมาในภาพการ์ตูนด้วย
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { ROOT, loadConfig } from './config.mjs'
import { PROMINENCE, prominenceOf } from '../../extension/prompts.js'

export { PROMINENCE, prominenceOf }

// PHI_PRODUCT_DIR: เทสต์ใช้โฟลเดอร์ชั่วคราวของตัวเอง — ห้ามแตะคลังจริง (23 พ.ย. 2026 เทสต์สองไฟล์ล้างคลังจริงพร้อมกันจน product.json หาย)
export const PRODUCT_DIR = process.env.PHI_PRODUCT_DIR || join(ROOT, 'characters', 'product')
const FILE = join(PRODUCT_DIR, 'product.json')
export const MAX_IMAGES = 8
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

export function readProduct() {
  const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {}
  const images = (data.images ?? []).filter((name) => existsSync(join(PRODUCT_DIR, name)))
  const chosen = images.includes(data.chosen) ? data.chosen : null
  return { images, chosen, description: data.description ?? '', pickedAt: data.pickedAt ?? null, sourceUrl: data.sourceUrl ?? '', pickedBy: chosen ? (data.pickedBy ?? 'ai') : null }
}

/**
 * ตัวตนของสินค้าจากลิ้ง — ลิ้ง Shopee มี -i.<ร้าน>.<สินค้า> หรือ /product/<ร้าน>/<สินค้า> · ไม่มีก็ใช้ host+path
 * ไม่เทียบทั้งลิ้งตรงๆ เพราะลิ้งของสินค้าเดียวกันมีพารามิเตอร์ติดตามต่อท้ายไม่เหมือนกันแทบทุกครั้ง
 */
export function productKey(url) {
  const raw = String(url ?? '').trim()
  if (!raw) return ''
  let text = raw
  try { text = decodeURIComponent(raw) } catch { /* มี % แปลกๆ ก็ใช้แบบเดิม */ }
  const id = /-i\.(\d+)\.(\d+)/.exec(text) ?? /\/product\/(\d+)\/(\d+)/.exec(text)
  if (id) return `${id[1]}.${id[2]}`
  try {
    const u = new URL(raw)
    return `${u.hostname}${u.pathname}`.toLowerCase()
  } catch {
    return text.toLowerCase()
  }
}

const settingUrl = () => loadConfig().script?.product?.url ?? ''

/**
 * รูปในคลังเป็นของสินค้าที่ตั้งไว้ตอนนี้หรือเปล่า
 * 23 พ.ย. 2026: เปลี่ยนลิ้งจากรองเท้าเป็นนาฬิกาแล้ว คลังยังเป็นรูปรองเท้า + คำบรรยายรองเท้า
 * บทจะเขียนว่านาฬิกาแต่บอกหน้าตาเป็นรองเท้า และ Flow ได้รูปรองเท้าเป็นแบบ · คลังรุ่นเก่าไม่มี sourceUrl = ถือว่าไม่ตรง
 */
export function productMatches(url = settingUrl()) {
  const { sourceUrl, images } = readProduct()
  if (!images.length) return false
  return !!sourceUrl && productKey(sourceUrl) === productKey(url)
}

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

function write(data) {
  mkdirSync(PRODUCT_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(data, null, 2))
  return readProduct()
}

export function addProductImage({ type, base64, source = 'paste', sourceUrl }) {
  const ext = Object.entries(MIME).find(([, m]) => m === type)?.[0]
  if (!ext) throw new Error('รองรับเฉพาะรูป PNG / JPG / WEBP')
  const buf = Buffer.from(String(base64), 'base64')
  if (!buf.length) throw new Error('ไฟล์รูปว่าง')
  if (buf.length > 6 * 1024 * 1024) throw new Error('รูปใหญ่เกิน 6MB')
  // รูปนี้เป็นของสินค้าไหน: ดึงจาก Shopee = ลิ้งที่ส่งมา · วางเอง = สินค้าที่ตั้งไว้ตอนนี้
  const url = String(sourceUrl ?? '').trim() || settingUrl()
  let cur = readProduct()
  // รูปของสินค้าตัวใหม่เข้ามา แต่คลังเป็นของสินค้าตัวอื่น (หรือคลังรุ่นเก่าที่ไม่รู้ว่าของใคร) → ล้างของเก่าก่อน
  // ไม่งั้นรูปสองสินค้าปนกัน คลังเต็ม 8 ใบจนรับรูปสินค้าใหม่ไม่ได้ และคำบรรยายเป็นของสินค้าเก่า
  if (cur.images.length && productKey(cur.sourceUrl) !== productKey(url)) cur = clearProduct()
  // ไฟล์ซ้ำทุกไบต์กับใบที่มีอยู่ = ไม่เพิ่ม (Shopee มีรูปเดียวกันหลาย URL — เคยได้ 8 ใบที่เป็นคู่ซ้ำ 4 คู่)
  const hash = sha1(buf)
  if (cur.images.some((n) => sha1(readFileSync(join(PRODUCT_DIR, n))) === hash)) return cur
  if (cur.images.length >= MAX_IMAGES) throw new Error(`ใส่รูปสินค้าได้สูงสุด ${MAX_IMAGES} รูป — ลบรูปเก่าก่อน`)
  mkdirSync(PRODUCT_DIR, { recursive: true })
  const name = `product_${source === 'shopee' ? 'shopee_' : ''}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${ext}`
  writeFileSync(join(PRODUCT_DIR, name), buf)
  return write({ ...cur, images: [...cur.images, name], chosen: cur.chosen, description: cur.description, sourceUrl: url })
}

export function removeProductImage(name) {
  const cur = readProduct()
  if (!cur.images.includes(name)) throw new Error('ไม่พบรูปนี้')
  unlinkSync(join(PRODUCT_DIR, name))
  const images = cur.images.filter((n) => n !== name)
  return write({ ...cur, images, chosen: cur.chosen === name ? null : cur.chosen })
}

/** ผลที่ ChatGPT เลือก — รูปที่ควรแนบให้ Flow + คำบรรยายหน้าตาสินค้า */
/**
 * by: 'user' = ผู้ใช้กดเลือกรูปเอง · 'ai' = ให้ ChatGPT/Gemini เลือก
 * ผู้ใช้ 23 พ.ย. 2026: "เราสามารถที่จะเลือกรูปภาพที่เราต้องการจะให้อัปโหลดไปเพื่อเป็น reference ได้เองด้วย"
 * รูปที่ผู้ใช้เลือกเองต้องไม่ถูก AI เลือกทับ — AI เขียนได้แค่คำบรรยาย (ส่ง chosen ว่าง = ไม่เปลี่ยนรูป)
 */
export function setProductPick({ chosen, description, by }) {
  const cur = readProduct()
  if (chosen && !cur.images.includes(chosen)) throw new Error('รูปที่เลือกไม่อยู่ในรายการ')
  const pickedBy = chosen ? (by === 'user' ? 'user' : 'ai') : cur.pickedBy
  return write({
    ...cur,
    chosen: chosen ?? cur.chosen,
    pickedBy,
    description: typeof description === 'string' ? description.trim().slice(0, 1000) : cur.description,
    pickedAt: Date.now(),
  })
}

export function clearProduct() {
  rmSync(PRODUCT_DIR, { recursive: true, force: true })
  return readProduct()
}

/**
 * รูปสินค้าที่จะแนบให้ Flow — รูปเดียวเท่านั้น ไม่แนบทั้งกอง ไม่งั้น Flow สับสนว่าจะวาดชิ้นไหน
 * ปกติใช้รูปที่ ChatGPT เลือกไว้ · ยังไม่ได้ให้เลือก (เพิ่งวางรูปเอง) ใช้รูปแรกไปก่อน
 *
 * รูปร่างต้องตรงกับ characterAttachments / styleKitAttachments เป๊ะ: { name, type, base64 }
 * (23 พ.ย. 2026: เคยคืนแค่ { name, path } ส่วนขยายเลยเรียก atob(undefined) แล้วล้มทั้งรอบ ได้ภาพ 0/27)
 */
export function productAttachment() {
  // รูปในคลังเป็นของสินค้าตัวอื่น = ไม่แนบ (Flow จะวาดสินค้าผิดตัว) ให้วาดจากชื่อไปก่อนจนกว่าจะดึงรูปใหม่
  if (!productMatches()) return null
  // แนบเฉพาะรูปที่เลือกแล้ว (ผู้ใช้กดเลือกเอง หรือสั่งให้ AI เลือก) — ไม่หยิบรูปแรกในคลังไปเอง
  // 24 พ.ย. 2026: ยังไม่ได้เลือก ระบบเลยแนบรูปแรก ซึ่งเป็นภาพโฆษณามีตัวหนังสือ "Metal Stand / Ring Light / Softbox"
  // Flow เอาภาพนั้นไปวาดใหม่ทั้งใบเป็นภาพปก → หน้าแรกของคลิปผีกลายเป็นหน้าร้าน Shopee
  // รูปจาก Shopee หลายใบเป็นภาพโฆษณา/แบนเนอร์ ไม่ใช่รูปสินค้า — ต้องมีคนเลือกก่อน ไม่เลือก = Flow วาดจากชื่อ
  const { chosen } = readProduct()
  const name = chosen
  if (!name) return null
  const type = MIME[extname(name).toLowerCase()]
  if (!type) return null
  try {
    return { name, type, base64: readFileSync(join(PRODUCT_DIR, name)).toString('base64'), picked: true }
  } catch {
    return null // อ่านไฟล์ไม่ได้ = ไม่แนบ ดีกว่าแนบรูปเปล่าแล้วพังทั้งรอบ
  }
}
