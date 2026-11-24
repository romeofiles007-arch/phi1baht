/**
 * คลังตัวละคร 48 ตัว — แผ่นแบบตัวละครที่ให้ ChatGPT วาดไว้ล่วงหน้า แล้วแนบให้ Flow เป็นแบบของคนคนนั้น
 *
 * ผู้ใช้ (23 พ.ย. 2026): "ตัวละครมันมั่วสลับไปสลับมา ก็เลยทำให้ Google Flow งง เพราะฉะนั้นทำตัวละคร
 * เผื่อไว้ทั้งหมด แล้วก็ไปสร้างใน ChatGPT Web ... เพื่อที่จะแนบไปสร้างภาพได้"
 *
 * บัญชีตัวละคร (ใครมีใครบ้าง หน้าตาเป็นอย่างไร) อยู่ที่ extension/prompts.js → CAST
 * เพราะทั้งส่วนขยายและโปรแกรมในเครื่องต้องอ่านชุดเดียวกัน · ที่นี่เก็บแค่ "รูปที่วาดเสร็จแล้ว"
 *
 * เก็บที่ characters/cast/ (ไม่ขึ้น git — .gitignore ครอบ characters/ ไว้แล้ว)
 *   cast.json      { sheets: { <id ตัวละคร>: { file, savedAt } } }
 *   <รูป>.png|jpg  แผ่นแบบตัวละคร 1 ไฟล์ต่อ 1 ตัว
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmSync } from 'node:fs'
import { join, extname } from 'node:path'
import { ROOT } from './config.mjs'
import { CAST, CAST_GROUPS, castById, castOfGroup, castSheetPrompt, castStyleCategory } from '../../extension/prompts.js'
import { styleKitAttachments } from './style-kit.mjs'

export { CAST, CAST_GROUPS, castById, castOfGroup, castSheetPrompt, castStyleCategory }

/**
 * งานวาดหนึ่งตัว: คำสั่ง + ภาพอ้างอิงลายเส้นที่ต้องแนบไปด้วย
 * ผู้ใช้ (23 พ.ย. 2026): "แนบสไตล์ที่เราต้องการไปด้วย" — ไม่แนบแล้ว ChatGPT วาดเป็นอนิเมะหรือลายเส้นดิจิทัล
 * ภาพอ้างอิงเลือกตามกลุ่มของตัวละคร (ผี→ฉากผี · นิทาน→ฉากนิทาน) ให้บรรยากาศใกล้กับที่จะใช้จริง
 */
export function castSheetJob(member) {
  const c = typeof member === 'string' ? castById(member) : member
  if (!c?.look) return null
  const attachments = styleKitAttachments(castStyleCategory(c))
  return { id: c.id, name: c.name, attachments, prompt: castSheetPrompt(c, { styleRefs: attachments.map((a) => a.name) }) }
}

// PHI_CAST_DIR: เทสต์ใช้โฟลเดอร์ชั่วคราวของตัวเอง — ห้ามแตะคลังตัวละครจริง 48 ตัวที่วาดไว้
export const CAST_DIR = process.env.PHI_CAST_DIR || join(ROOT, 'characters', 'cast')
const FILE = join(CAST_DIR, 'cast.json')
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
/** แผ่นเดียวมี 3 ท่า ภาพจึงใหญ่กว่ารูปตัวละครธรรมดา แต่ต้องไม่ใหญ่จน Flow อัปโหลดไม่ไหว */
export const MAX_BYTES = 6 * 1024 * 1024

/** รูปที่วาดเสร็จแล้ว — ข้ามรายการที่ไฟล์หายไปจากดิสก์ และข้าม id ที่ไม่อยู่ในบัญชีแล้ว */
export function readCast() {
  const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {}
  const sheets = {}
  for (const [id, entry] of Object.entries(data.sheets ?? {})) {
    const file = entry?.file
    if (!file || !castById(id) || !existsSync(join(CAST_DIR, file))) continue
    sheets[id] = { file, savedAt: entry.savedAt ?? null }
  }
  return { sheets }
}

function write(data) {
  mkdirSync(CAST_DIR, { recursive: true })
  writeFileSync(FILE, JSON.stringify(data, null, 2))
  return readCast()
}

export function addCastSheet({ id, type, base64 }) {
  const member = castById(id)
  if (!member) throw new Error(`ไม่รู้จักตัวละคร "${id}" — ดูรายชื่อได้ที่บัญชีตัวละคร 48 ตัว`)
  const ext = Object.entries(MIME).find(([, m]) => m === type)?.[0]
  if (!ext) throw new Error('รองรับเฉพาะรูป PNG / JPG / WEBP')
  const buf = Buffer.from(String(base64 ?? ''), 'base64')
  if (!buf.length) throw new Error('ไฟล์รูปว่าง')
  if (buf.length > MAX_BYTES) throw new Error(`รูปใหญ่เกิน ${Math.round(MAX_BYTES / 1024 / 1024)}MB`)
  const cur = readCast()
  // วาดใหม่ทับตัวเดิม = ลบไฟล์เก่าทิ้ง ไม่ให้คลังบวมด้วยรูปที่ไม่มีใครอ้างถึง
  const old = cur.sheets[member.id]?.file
  mkdirSync(CAST_DIR, { recursive: true })
  const file = `cast_${member.id}_${Date.now().toString(36)}${ext}`
  writeFileSync(join(CAST_DIR, file), buf)
  if (old && old !== file) try { unlinkSync(join(CAST_DIR, old)) } catch { /* ไฟล์หายไปแล้ว ไม่เป็นไร */ }
  return write({ sheets: { ...cur.sheets, [member.id]: { file, savedAt: Date.now() } } })
}

export function removeCastSheet(id) {
  const cur = readCast()
  const entry = cur.sheets[id]
  if (!entry) throw new Error('ยังไม่มีแผ่นแบบของตัวละครนี้')
  try { unlinkSync(join(CAST_DIR, entry.file)) } catch { /* ไฟล์หายไปแล้ว ไม่เป็นไร */ }
  const sheets = { ...cur.sheets }
  delete sheets[id]
  return write({ sheets })
}

export function clearCast() {
  rmSync(CAST_DIR, { recursive: true, force: true })
  return readCast()
}

/** ตัวละครที่ยังไม่มีแผ่นแบบ — แผงข้างใช้สั่ง ChatGPT วาดเฉพาะตัวที่ขาด ไม่วาดซ้ำตัวที่มีแล้ว */
export function missingCast() {
  const { sheets } = readCast()
  return CAST.filter((c) => !sheets[c.id])
}

/** สรุปให้แผงข้างแสดง — ทุกตัวในบัญชี พร้อมบอกว่ามีแผ่นแบบแล้วหรือยัง */
export function castStatus() {
  const { sheets } = readCast()
  return {
    total: CAST.length,
    done: Object.keys(sheets).length,
    groups: CAST_GROUPS.map((g) => ({
      ...g,
      members: castOfGroup(g.id).map((c) => ({ id: c.id, name: c.name, look: c.look, file: sheets[c.id]?.file ?? null })),
    })),
  }
}

/**
 * รูปที่จะแนบให้ Flow — เฉพาะตัวละครที่คลิปนี้ใช้จริง เรียงตามที่ส่ง id มา
 * ห้ามแนบทั้งคลัง 48 รูป: แนบรูปเยอะคือสาเหตุที่ Flow สับสนตั้งแต่แรก
 * ตัวที่ยังไม่มีแผ่นแบบจะถูกข้ามเงียบๆ (Flow ใช้คำบรรยายใน Character Bible ไปตามเดิม)
 */
export function castAttachments(ids = [], { max = 3 } = {}) {
  const { sheets } = readCast()
  const out = []
  for (const id of ids) {
    const member = castById(id)
    const entry = member && sheets[member.id]
    if (!entry || out.length >= max) continue
    const path = join(CAST_DIR, entry.file)
    const type = MIME[extname(entry.file).toLowerCase()]
    if (!type) continue
    try {
      out.push({ name: entry.file, type, base64: readFileSync(path).toString('base64'), castId: member.id, castName: member.name })
    } catch {
      // อ่านไฟล์ไม่ได้ = ข้ามตัวนี้ ดีกว่าแนบรูปเปล่าแล้วล้มทั้งรอบ
    }
  }
  return out
}
