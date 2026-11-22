/**
 * Style Kit — ภาพอ้างอิงลายเส้นของเราเอง (spec 5.4 ชั้น 1) แนบเป็น ingredient ให้ Flow คู่กับรูปตัวละคร
 *
 * เก็บที่ extension/style-kit/ (งานของเราเอง ส่งไปกับแอปได้ จดที่มาทุกภาพ)
 *   kit.json  { files: [{ file, categories: ['ghost', ...], kind: 'scene' | 'cover' | 'palette' }] }
 *   <ภาพ>     png / jpg / webp — ภาพสีทั้งหมด (ฉากการ์ตูนลงสีเต็มเฟรม · ปก · แถบชุดสีของหมวด)
 *
 * kit ยังว่าง (ภาพทำทีหลัง) / ไฟล์หาย / kit.json เสีย = [] ไม่ throw — คลิปทำต่อได้ด้วยกติกาตัวหนังสืออย่างเดียว
 * ห้ามอ้างภาพเล่มจริงใต้ references/ (ลิขสิทธิ์นักวาด ใช้ในเครื่องเท่านั้น) — ไฟล์ต้องอยู่ในโฟลเดอร์ kit เท่านั้น
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative, isAbsolute, extname } from 'node:path'
import { ROOT } from './config.mjs'

export const STYLE_KIT_DIR = join(ROOT, 'extension', 'style-kit')
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
/** ภาพฉากมาก่อน (ตรงกับช็อตในเรื่อง) → แถบชุดสี → ปก (มีตัวหนังสือ/โลโก้ ใช้เมื่อไม่มีอย่างอื่น) */
const KIND_RANK = { scene: 0, palette: 1, cover: 2 }

/** ไฟล์ของ kit ที่ใช้กับหมวดนี้ (ยังไม่อ่านเนื้อไฟล์) — dir ใช้ตอนทดสอบ */
export function styleKitFiles(categoryId, { max = 2, dir = STYLE_KIT_DIR } = {}) {
  let kit
  try {
    kit = JSON.parse(readFileSync(join(dir, 'kit.json'), 'utf8'))
  } catch {
    return []
  }
  const root = resolve(dir)
  const entries = Array.isArray(kit?.files) ? kit.files : []
  return entries
    .map((entry, order) => ({ ...entry, order, path: resolve(root, String(entry?.file ?? '')) }))
    .filter((f) => {
      if (typeof f.file !== 'string' || !MIME[extname(f.file).toLowerCase()]) return false
      if (!Array.isArray(f.categories) || !f.categories.includes(categoryId)) return false // ชุดสีหมวดอื่นไม่ปน
      const rel = relative(root, f.path)
      if (!rel || rel.startsWith('..') || isAbsolute(rel) || /(^|[\\/])references([\\/]|$)/i.test(rel)) return false
      try {
        return existsSync(f.path) && statSync(f.path).isFile()
      } catch {
        return false
      }
    })
    .sort((a, b) => (KIND_RANK[a.kind] ?? 0) - (KIND_RANK[b.kind] ?? 0) || a.order - b.order)
    .slice(0, Math.max(0, max))
    .map(({ file, categories, kind, path }) => ({ file, categories, kind: KIND_RANK[kind] === undefined ? 'scene' : kind, path }))
}

/**
 * ภาพ Style Kit ของหมวด สำหรับแนบไปกับงาน Flow (รูปแบบเดียวกับ characterAttachments)
 * @returns {Array<{ name: string, type: string, base64: string }>}
 */
export function styleKitAttachments(categoryId, { max = 2, dir = STYLE_KIT_DIR } = {}) {
  const out = []
  for (const f of styleKitFiles(categoryId, { max, dir })) {
    try {
      out.push({ name: f.file.split(/[\\/]/).pop(), type: MIME[extname(f.file).toLowerCase()], base64: readFileSync(f.path).toString('base64') })
    } catch {
      // อ่านไม่ได้ = ข้ามภาพนี้
    }
  }
  return out
}
