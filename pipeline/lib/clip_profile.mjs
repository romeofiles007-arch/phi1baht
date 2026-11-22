/**
 * โปรไฟล์ของคลิป — หมวดเนื้อหา + ลายเส้น + แนวเนื้อหา
 *
 * เก็บที่ projects/<slug>/00_ref/profile.json   { category, title, artStyle, mood }
 *
 * หมวดมาจาก: แนวที่เลือก/คอลัมน์ Genre ของหัวข้อ → ถ้าไม่รู้ ดูจากชื่อเรื่อง
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadConfig } from './config.mjs'
import { categoryOf, ART_STYLES, RETIRED_ART_STYLES, resolveMood } from '../../extension/prompts.js'

export const refDir = (slug) => join(ROOT, 'projects', slug, '00_ref')
const profileFile = (slug) => join(refDir(slug), 'profile.json')

/**
 * โปรไฟล์คลิปยุคธรรมะ (ก่อน พ.ย. 2026) — หมวดเก่า รูปพระ และวิธีเล่าแบบเก่า
 * อ่านแล้วแปลงเป็นของใหม่ทันที และทิ้งรูปอ้างอิงเก่าเสมอ
 */
const LEGACY_CATEGORY = { buddha: 'sanguo', monk: 'sage', dhamma: 'tale' }
export function migrateProfile(profile) {
  if (!profile) return profile
  if (LEGACY_CATEGORY[profile.category]) profile.category = LEGACY_CATEGORY[profile.category]
  delete profile.narration
  delete profile.self
  delete profile.figure
  delete profile.monk
  delete profile.buddha
  return profile
}

export function readProfile(slug) {
  if (!slug) return null
  try {
    const profile = migrateProfile(existsSync(profileFile(slug)) ? JSON.parse(readFileSync(profileFile(slug), 'utf8')) : null)
    // ลายเส้นที่เลิกใช้แล้ว (ภาพวาดจีน) → อ่านเป็นลายเส้นที่มาแทน ไม่แก้ไฟล์ของคลิป
    if (profile && RETIRED_ART_STYLES[profile.artStyle]) profile.artStyle = RETIRED_ART_STYLES[profile.artStyle]
    return profile
  } catch {
    return null
  }
}

function saveProfile(slug, profile) {
  mkdirSync(refDir(slug), { recursive: true })
  writeFileSync(profileFile(slug), JSON.stringify(profile, null, 2))
  return profile
}

// คำจับหมวด 1 — ครอบคลุมวรรณกรรมจีนคลาสสิกทุกเรื่องที่ใช้ได้ ไม่ใช่แค่สามก๊ก
const SANGUO_WORDS = /สามก๊ก|ขงเบ้ง|จูกัดเหลียง|กวนอู|เล่าปี่|เตียวหุย|โจโฉ|ซุนกวน|ซุนเซ็ก|จูล่ง|สุมาอี้|จิวยี่|ลิโป้|ลกซุน|เกียงอุย|ฮวาโต๋|ม้าเฉียว|ตั๋งโต๊ะ|อ้วนเสี้ยว|เตียวเสียน|ผาแดง|เกงจิ๋ว|ไซอิ๋ว|เห้งเจีย|ซุนหงอคง|ซัมจั๋ง|เสวียนจั้ง|ตือโป๊ยก่าย|ซัวเจ๋ง|ซ้องกั๋ง|เหลียงซาน|บู๊สง|ลิมชอง|หลินชง|โลจิซิม|ห้องสิน|เกียงจูแหย|จื่อหยา|นาจา|หอแดง|เปาบุ้นจิ้น|ฌ้อปาอ๋อง|เซี่ยงหยี่|หลิวปัง|ฮั่นเกาจู่|หันสิน|เตียวเหลียง|ชอหาน|เลียดก๊ก|ตระกูลหยาง|มู่กุ้ยอิง|งักฮุย|มู่หลาน|เซฺว เหรินกุ้ย|จิ๋นซี|บูเช็กเทียน|ซือหม่า เชียน|ซือหม่าเชียน|หลี่ ไป๋|หลี่ไป๋|ไซซี|กุ้ยเฟย|ขุนศึก|แม่ทัพ|ราชวงศ์|ฮ่องเต้|จ๊กก๊ก|วุยก๊ก|ง่อก๊ก/
const SAGE_WORDS = /ขงจื๊อ|เล่าจื๊อ|จวงจื่อ|จวงจื๊อ|เม่งจื๊อ|ซุนวู|ม่อจื๊อ|ฮั่นเฟย|พิชัยสงคราม|เต้าเต๋อ|หลุนหยฺวี่|ปรัชญาจีน|เต๋า|ขงจื่อ/

/**
 * ลายเส้นของคลิป ตามตั้งค่าคลิปตอนเริ่มทำ ("สุ่ม" = เลือกตอนนี้แล้วบันทึกไว้ ใช้ลายเส้นเดียวทั้งคลิป)
 */
function clipStyle() {
  const config = loadConfig()
  const pick = (list) => list[Math.floor(Math.random() * list.length)]
  // ผลิตต่อเนื่องส่ง CLIP_ART_STYLE มาแทนตั้งค่าคลิป (สุ่มต่อคลิปโดยไม่แก้ค่าที่ผู้ใช้ตั้งไว้)
  const chosen = process.env.CLIP_ART_STYLE || config.art?.style
  const art = RETIRED_ART_STYLES[chosen] ?? chosen
  const artStyle = ART_STYLES[art] && art !== 'random' ? art : art === 'random' ? pick(Object.keys(ART_STYLES).filter((k) => k !== 'random')) : 'doodle'
  return { artStyle }
}

/** เดาหมวดจากชื่อเรื่อง */
export function detectCategory(title) {
  const t = String(title ?? '')
  if (SAGE_WORDS.test(t)) return 'sage'
  if (SANGUO_WORDS.test(t)) return 'sanguo'
  return 'tale'
}

/**
 * โปรไฟล์ของคลิป — สร้างครั้งแรกแล้วเก็บไว้ (เรียกซ้ำได้ ไม่ดึงซ้ำ)
 * genre = แนวที่ผู้ใช้เลือก หรือคอลัมน์ Genre ของหัวข้อที่ ChatGPT เสนอ
 */
export async function ensureProfile(slug, { title, genre, log = console.log } = {}) {
  let profile = readProfile(slug)
  if (!profile) {
    const category = categoryOf(genre)?.id ?? detectCategory(title)
    // แนวเนื้อหา: autopilot สุ่มไว้แล้วตอนคิดหัวข้อ (CLIP_MOOD) → หัวข้อกับบทเป็นแนวเดียวกัน
    profile = { category, title, ...clipStyle(), mood: resolveMood(process.env.CLIP_MOOD || loadConfig().script?.mood) }
    saveProfile(slug, profile)
    log(`   หมวดของคลิป: ${profile.category}${profile.mood === 'happy' ? ' · แนวเพิ่มความสุข' : ''}`)
  }
  return profile
}
