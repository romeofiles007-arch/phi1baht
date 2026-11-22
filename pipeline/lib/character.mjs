/**
 * ตัวละครของฉัน — ไม่ได้ตั้งไว้ = ใช้ตัวละครตาม Blueprint / ตั้งไว้ = ใช้ตัวละครนี้ทุกคลิปจนกว่าจะลบ
 *
 * เก็บที่ characters/current/ (ไม่ขึ้น git)
 *   character.json   { enabled, description, images: [ชื่อไฟล์] }
 *   <รูป>.png|jpg    รูปตัวละครที่วางด้วย Ctrl+V ในแผงข้าง (สูงสุด 4 รูป)
 *
 * ใช้ 2 ที่:
 *   - ChatGPT รอบแรกของ Shot List: แนบรูป + คำอธิบาย ให้เขียน Character Bible จากตัวละครนี้แทนของ Blueprint
 *   - Google Flow prompt แรก: แนบรูปเป็น ingredient ให้ agent ล็อกหน้าตาตัวละครตามรูป
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { ROOT } from './config.mjs'
import { artStyleOf } from '../../extension/prompts.js'

export const CHARACTER_DIR = join(ROOT, 'characters', 'current')
const FILE = join(CHARACTER_DIR, 'character.json')
export const MAX_IMAGES = 4
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

export function readCharacter() {
  const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {}
  const images = (data.images ?? []).filter((name) => existsSync(join(CHARACTER_DIR, name)))
  return { enabled: data.enabled !== false, description: data.description ?? '', images }
}

function write(data) {
  mkdirSync(CHARACTER_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(data, null, 2))
  return readCharacter()
}

export function updateCharacter({ enabled, description }) {
  const cur = readCharacter()
  return write({
    ...cur,
    ...(typeof enabled === 'boolean' && { enabled }),
    ...(typeof description === 'string' && { description: description.trim().slice(0, 4000) }),
  })
}

export function addCharacterImage({ type, base64 }) {
  const cur = readCharacter()
  if (cur.images.length >= MAX_IMAGES) throw new Error(`ใส่รูปตัวละครได้สูงสุด ${MAX_IMAGES} รูป — ลบรูปเก่าก่อน`)
  const ext = Object.entries(MIME).find(([, m]) => m === type)?.[0]
  if (!ext) throw new Error('รองรับเฉพาะรูป PNG / JPG / WEBP')
  const buf = Buffer.from(String(base64), 'base64')
  if (buf.length > 6 * 1024 * 1024) throw new Error('รูปใหญ่เกิน 6MB')
  mkdirSync(CHARACTER_DIR, { recursive: true })
  const name = `character_${Date.now().toString(36)}${ext}`
  writeFileSync(join(CHARACTER_DIR, name), buf)
  return write({ ...cur, images: [...cur.images, name] })
}

export function removeCharacterImage(name) {
  const cur = readCharacter()
  if (!cur.images.includes(name)) throw new Error('ไม่พบรูปนี้')
  unlinkSync(join(CHARACTER_DIR, name))
  return write({ ...cur, images: cur.images.filter((n) => n !== name) })
}

export function clearCharacter() {
  if (existsSync(CHARACTER_DIR)) for (const f of readdirSync(CHARACTER_DIR)) unlinkSync(join(CHARACTER_DIR, f))
  return readCharacter()
}

/**
 * ตัวละครหลักของคลิป — ตัวละครของฉัน ถ้าเปิดไว้และมีรูปหรือคำอธิบาย ใช้ได้ทุกหมวด
 * (ผี 1 บาทเป็นเรื่องแต่งทุกหมวด ไม่มีบุคคลจริงที่ต้องเป็นตัวหลักแทน) · ผู้เรียกเดิมยังส่ง slug มาได้ ไม่มีผล
 */
export function activeCharacter() {
  const c = readCharacter()
  return c.enabled && (c.images.length || c.description) ? c : null
}

/** รูปสำหรับแนบไปกับงาน (ChatGPT / Flow) */
export function characterAttachments(c = activeCharacter()) {
  if (!c) return []
  return c.images.map((name) => ({
    name,
    type: MIME[extname(name).toLowerCase()] ?? 'image/png',
    base64: readFileSync(join(c.dir ?? CHARACTER_DIR, name)).toString('base64'),
  }))
}

/** กฎตัวละครสำหรับ ChatGPT รอบแรก — แทนตัวละครตัวอย่างของ Blueprint (ตัวละครหลักตามลายเส้นของคลิป) */
export function characterRule(c = activeCharacter(), profile = null) {
  if (!c) return ''
  const lines = ['- ตัวละครหลักของคลิปนี้กำหนดไว้แล้ว — ใช้ตัวละครนี้แทนตัวละครตัวอย่างใน Blueprint (กฎอื่นของ Blueprint ใช้เหมือนเดิม)']
  if (c.images.length) lines.push(`- รูปที่แนบ ${c.images.length} รูปคือตัวละครหลัก: เขียน Character Bible ตามหน้าตา ทรงผม สีผิว ชุด สี และสัดส่วนในรูปให้ละเอียด ให้ภาพทุกช็อตออกมาเป็นตัวเดียวกับในรูป`)
  if (c.description) lines.push(`- คำอธิบายตัวละครหลัก: ${c.description}`)
  lines.push('- ตัวละครรองอื่นที่เรื่องต้องใช้ ออกแบบให้เข้ากับสไตล์ของตัวละครหลัก')
  return lines.join('\n')
}

/**
 * แบบตัวละครสำหรับ ChatGPT — ตามลายเส้นของคลิป (lemlabaht: การ์ตูนเล่มละบาทยุค 2520 สัดส่วนสมจริง)
 * แนบรูปตัวละครหรือไม่ก็ใช้แบบเดียวกัน (แบบ doodle หัวโต/ตัวก้างของแอปต้นแบบเลิกใช้)
 */
export function bodyStyleRule(c = activeCharacter(), profile = null) {
  return artStyleOf(profile).body
}

/** บรรทัดแบบตัวละครสำหรับคำสั่ง Flow */
export function bodyStyleFlowNote(c = activeCharacter(), profile = null) {
  return artStyleOf(profile).bodyFlow
}

/** ข้อความต่อท้ายคำสั่ง Flow เมื่อแนบรูปตัวละคร (ตัวละครหลักตามลายเส้นของคลิป) */
export function characterFlowNote(c = activeCharacter(), profile = null) {
  if (!c?.images.length) return ''
  const n = c.images.length
  return `รูปที่แนบ ${n} รูปแรก (ลำดับที่ 1–${n}) คือตัวละครหลักของคลิป — ล็อกหน้าตา ทรงผม สี และชุดตามรูปเหล่านี้ในทุกภาพ (รูปที่แนบหลังจากนั้นเป็นแค่ภาพอ้างอิงลายเส้น ไม่ใช่ตัวละคร)`
}
