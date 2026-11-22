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
import { join, extname, basename } from 'node:path'
import { ROOT } from './config.mjs'
import { readProfile, profileImages, refDir } from './clip_profile.mjs'
import { ART_STYLES, figureStyle, selfNarratorName } from '../../extension/prompts.js'
import { readSelfNarrator, SELF_DIR } from './self_narrator.mjs'

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
 * ตัวละครหลักของคลิป
 *   - หมวดที่มีบุคคลจริงและมีภาพอ้างอิง → ภาพบุคคลนั้นของคลิปนั้น (projects/<slug>/00_ref/)
 *   - หมวดสามก๊ก / ปราชญ์จีนที่ไม่มีภาพ → ไม่ใช้ตัวละครของฉัน (ตัวหลักคือบุคคลในเรื่อง)
 *   - อื่นๆ → ตัวละครของฉัน ถ้าเปิดไว้และมีรูปหรือคำอธิบาย
 */
export function activeCharacter(slug) {
  const profile = slug ? readProfile(slug) : null
  // โหมดผู้เล่าเรื่อง: ตัวหลักคือเจ้าของช่องเอง (รูปจาก "ผู้เล่าของฉัน") — ไม่ใช้ตัวละครของฉัน
  if (profile?.category === 'self') {
    const m = readSelfNarrator()
    const name = selfNarratorName(profile)
    return { enabled: true, description: [`ผู้เล่าเรื่องในคลิป: ${name} (ตัวละคร @host)`, m.description].filter(Boolean).join(' · '), images: m.images, dir: SELF_DIR, selfHost: name, selfNote: m.description }
  }
  const refs = profileImages(profile, slug)
  if (refs.length && profile.figure) {
    return { enabled: true, description: `บุคคลหลักของคลิปนี้: ${profile.figure.name} (ตัวละคร @hero)`, images: refs.map((f) => basename(f)), dir: refDir(slug), figure: profile.figure.name }
  }
  if (profile?.category === 'sanguo' || profile?.category === 'sage') return null
  const c = readCharacter()
  return c.enabled && (c.images.length || c.description) ? c : null
}

/** หมวดที่ตัวละครหลักต้องเป็นการ์ตูนเต็มตัวเสมอ (บุคคลในประวัติศาสตร์ ห้ามเป็นตัวก้าง) */
const fullBodyOf = (c, profile) => !!c?.images.length || ['sanguo', 'sage', 'self'].includes(profile?.category)

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
  const figure = figureStyle(profile)
  const lines = ['- ตัวละครหลักของคลิปนี้กำหนดไว้แล้ว — ใช้ตัวละครนี้แทนตัวละครตัวอย่างใน Blueprint (กฎอื่นของ Blueprint ใช้เหมือนเดิม)']
  if (c.selfHost) {
    lines.push(c.images.length
      ? `- รูปที่แนบ ${c.images.length} รูปคือภาพจริงของ${c.selfHost} ผู้เล่าเรื่องในคลิปนี้: เขียน Character Bible ของ @host ตามรูปหน้า ใบหน้า วัย ทรงผม แว่นตา (ถ้ามี) ให้ละเอียด สวมชุดจีนโบราณเรียบๆ เป็นการ์ตูนเต็มตัวหน้าเหมือนท่าน อย่างเคารพตามกฎ SACRED FIGURES`
      : `- ${c.selfHost} ผู้เล่าเรื่องในคลิปนี้ (@host): การ์ตูนเต็มตัว สวมชุดจีนโบราณเรียบๆ ท่าทางเป็นมิตร`)
    if (c.selfNote) lines.push(`- รายละเอียดเพิ่มเติมของท่าน: ${c.selfNote}`)
    lines.push('- ตัวละครอื่น (คนในเรื่องที่ยกตัวอย่าง) ออกแบบให้เข้ากับสไตล์เดียวกัน')
    return lines.join('\n')
  }
  if (c.figure) {
    lines.push(`- รูปที่แนบ ${c.images.length} รูปคือภาพวาด/รูปปั้นโบราณของ${c.figure}: เขียน Character Bible ของ @hero ตามใบหน้า เครา ทรงผม หมวก และสีชุดในรูป ทำเป็น${figure}อย่างให้เกียรติตามกฎ HISTORICAL FIGURES · ห้ามวาดเลียนแบบนักแสดง`)
    lines.push('- ตัวละครอื่น (ขุนศึก ทหาร ชาวบ้าน ลูกศิษย์) ออกแบบให้เข้ากับสไตล์เดียวกัน')
    return lines.join('\n')
  }
  if (c.images.length) lines.push(`- รูปที่แนบ ${c.images.length} รูปคือตัวละครหลัก: เขียน Character Bible ตามหน้าตา ทรงผม สีผิว ชุด สี และสัดส่วนในรูปให้ละเอียด ให้ภาพทุกช็อตออกมาเป็นตัวเดียวกับในรูป`)
  if (c.description) lines.push(`- คำอธิบายตัวละครหลัก: ${c.description}`)
  lines.push('- ตัวละครรองอื่นที่เรื่องต้องใช้ ออกแบบให้เข้ากับสไตล์ของตัวละครหลัก')
  return lines.join('\n')
}

/** แบบตัวละคร: แนบรูปอ้างอิง = การ์ตูนเต็มตัว · ไม่แนบ = การ์ตูน doodle หัวโต แขนขาเป็นหลอดมีความหนา (ไม่ใช่ตัวก้าง) — Blueprint มีทั้ง 2 แบบ ระบบบอกว่าคลิปนี้ใช้แบบไหน */
export function bodyStyleRule(c = activeCharacter(), profile = null) {
  // ลายเส้นภาพวาด (สีน้ำพุทธกาล / ภาพวาดจีน): สัดส่วนสมจริง ไม่ใช่การ์ตูน (รายละเอียดอยู่ใน ART_STYLES ที่ต่อท้าย prompt)
  const painted = ART_STYLES[profile?.artStyle]?.body
  if (painted) return painted
  return fullBodyOf(c, profile)
    ? '- แบบตัวละคร: FULL-BODY MODE — ตัวละครทุกตัวเป็นการ์ตูนเต็มตัว มีลำตัว แขนขาหนา มือ รองเท้า เสื้อผ้าชัด ห้ามวาดเป็นตัวก้าง (stick figure) ห้ามแขนขาเป็นเส้นขีดเดียว · เขียนแบบนี้ใน Character Bible ด้วย'
    : '- แบบตัวละคร: SIMPLE MODE (ไม่มีรูปตัวละครแนบ) — ตัวละครทุกตัวเป็นการ์ตูน doodle หัวกลมโต ลำตัวเล็กทรงมน แขนขาเป็นทรงหลอดมีความหนา มีเส้นขอบสองข้างและลงสีเต็ม มือกลมแบบถุงมือ · ห้ามวาดเป็นตัวก้าง (stick figure) ห้ามแขนขาเป็นเส้นขีดเดียว · เขียนแบบนี้ใน Character Bible ด้วย'
}

/** บรรทัดแบบตัวละครสำหรับคำสั่ง Flow */
export function bodyStyleFlowNote(c = activeCharacter(), profile = null) {
  const painted = ART_STYLES[profile?.artStyle]?.bodyFlow
  if (painted) return painted
  return fullBodyOf(c, profile)
    ? 'ตัวละครทุกตัวเป็นการ์ตูนเต็มตัว (ลำตัว แขนขามีความหนา มีเสื้อผ้า) ห้ามวาดเป็นตัวก้าง ห้ามแขนขาเป็นเส้นขีดเดียว'
    : 'ตัวละครทุกตัวเป็นการ์ตูน doodle หัวกลมโต แขนขาเป็นทรงหลอดมีความหนา มีเส้นขอบและลงสีเต็ม ห้ามวาดเป็นตัวก้าง ห้ามแขนขาเป็นเส้นขีดเดียว'
}

/** ข้อความต่อท้ายคำสั่ง Flow เมื่อแนบรูปตัวละคร (ตัวละครหลักตามลายเส้นของคลิป) */
export function characterFlowNote(c = activeCharacter(), profile = null) {
  if (!c?.images.length) return ''
  const figure = figureStyle(profile)
  if (c.selfHost) return `รูปที่แนบคือภาพจริงของ${c.selfHost} ผู้เล่าเรื่องในคลิป (ตัวละคร @host) — ทำเป็น${figure}หน้าเหมือนท่าน ห่มจีวร อย่างเคารพ ล็อกใบหน้า วัย รูปร่าง และสีจีวรตามรูปในทุกภาพ ห้ามล้อเลียน`
  if (c.figure) return `รูปที่แนบคือภาพวาด/รูปปั้นโบราณของ${c.figure} (ตัวละคร @hero) — ทำเป็น${figure}อย่างให้เกียรติ ล็อกใบหน้า เครา ทรงผม หมวก และสีชุดตามรูปในทุกภาพ ห้ามวาดล้อเลียน ห้ามวาดเลียนแบบนักแสดง`
  return 'รูปที่แนบคือตัวละครหลัก ล็อกหน้าตา ทรงผม สี และชุดตามรูปนี้ในทุกภาพ'
}
