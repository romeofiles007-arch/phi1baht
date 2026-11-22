/**
 * โปรไฟล์ของคลิป — หมวดเนื้อหา + ลายเส้น + ระดับความสยอง
 *
 * เก็บที่ projects/<slug>/00_ref/profile.json   { category, title, artStyle, scare }
 *
 * หมวดมาจาก: แนวที่เลือก/คอลัมน์ Genre ของหัวข้อ → ถ้าไม่รู้ ดูจากชื่อเรื่อง
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadConfig } from './config.mjs'
import { CATEGORIES, categoryOf, ART_STYLES, RETIRED_ART_STYLES, resolveScare, scareApplies, SCARE_LEVELS } from '../../extension/prompts.js'

export const refDir = (slug) => join(ROOT, 'projects', slug, '00_ref')
const profileFile = (slug) => join(refDir(slug), 'profile.json')

/**
 * โปรไฟล์ที่เขียนด้วยแอปรุ่นก่อน (หมวดที่ไม่มีแล้ว ฟิลด์ของฟีเจอร์ที่ตัดออก) → อ่านเป็นของใหม่
 * หมวดที่ไม่รู้จัก = เดาจากชื่อเรื่อง · แนวเนื้อหาเดิม (mood) ไม่ใช้แล้ว
 */
export function migrateProfile(profile) {
  if (!profile) return profile
  if (!CATEGORIES.some((c) => c.id === profile.category)) profile.category = detectCategory(profile.title)
  for (const old of ['narration', 'self', 'figure', 'monk', 'buddha', 'mood']) delete profile[old]
  return profile
}

export function readProfile(slug) {
  if (!slug) return null
  try {
    const profile = migrateProfile(existsSync(profileFile(slug)) ? JSON.parse(readFileSync(profileFile(slug), 'utf8')) : null)
    // ลายเส้นที่เลิกใช้แล้ว (doodle/inkwash/...) หรือไม่มีค่า → อ่านเป็น lemlabaht ไม่แก้ไฟล์ของคลิป
    if (profile && !ART_STYLES[profile.artStyle]) profile.artStyle = RETIRED_ART_STYLES[profile.artStyle] ?? 'lemlabaht'
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

/**
 * คำจับหมวดจากชื่อเรื่อง — เช็กตามลำดับ (ตลกก่อน เพราะ "หมอผีปลอม" "ขี้โม้นอนป่าช้า" มีคำผีอยู่ด้วย)
 * ไม่ตรงหมวดไหน = ผีไทย (หมวดหลัก)
 */
const CATEGORY_WORDS = [
  ['comedy', /ตลก|ขำ|หัวเราะ|ป่วน|ขี้โม้|ขี้ขลาด|หมอผีปลอม|ทิดจ่อย|หูตึง|โดนเอง/],
  ['folk', /ยักษ์|นางฟ้า|เจ้าชาย|เจ้าหญิง|ของวิเศษ|สังข์ทอง|เงาะ|ปลาบู่|ไกรทอง|ชาละวัน|ขุนแผน|ขุนช้าง|ศรีธนญชัย|พระรถ|เมรี|โสนน้อย|นางเงือก|ฤๅษี|ฤาษี|พญานาค|จักรๆ|นิทาน|เมืองยักษ์|ม้าวิเศษ/],
  ['saiyasat', /หมอผี|ไสย|ตะกรุด|ยันต์|คาถา|ของขลัง|ของเฮี้ยน|ธุดงค์|ศาลพระภูมิ|หุ่นพยนต์|เสือสมิง|ยาสั่ง|ทำของ|มนต์ดำ/],
  ['ghost', /ผี|กระสือ|ปอบ|กระหัง|พราย|ตานี|ตะเคียน|โพง|กองกอย|เปรต|วิญญาณ|หลอน|ป่าช้า|โลงศพ|หลุมศพ|บ้านร้าง/],
  ['drama', /อกตัญญู|เมียน้อย|เมียหลวง|เศรษฐี|ลูกเขย|แม่เลี้ยง|ทรยศ|มรดก|การพนัน|คนจน|คนรวย|ดราม่า|หลงเงิน/],
]

/**
 * ลายเส้นของคลิป — ผี 1 บาทมีลายเส้นเดียว (lemlabaht) ไม่มีตัวเลือก/สุ่ม · ค่าตั้งเก่า (config.art.style, CLIP_ART_STYLE) ไม่มีผล
 */
function clipStyle() {
  return { artStyle: 'lemlabaht' }
}

/** เดาหมวดจากชื่อเรื่อง */
export function detectCategory(title) {
  const t = String(title ?? '')
  return CATEGORY_WORDS.find(([, re]) => re.test(t))?.[0] ?? 'ghost'
}

/**
 * โปรไฟล์ของคลิป — สร้างครั้งแรกแล้วเก็บไว้ (เรียกซ้ำได้ ไม่ดึงซ้ำ)
 * genre = แนวที่ผู้ใช้เลือก หรือคอลัมน์ Genre ของหัวข้อที่ ChatGPT เสนอ
 */
export async function ensureProfile(slug, { title, genre, log = console.log } = {}) {
  let profile = readProfile(slug)
  if (!profile) {
    const category = categoryOf(genre)?.id ?? detectCategory(title)
    // ระดับความสยอง: autopilot สุ่มไว้แล้วตอนคิดหัวข้อ (CLIP_SCARE) → หัวข้อ บท และภาพเป็นระดับเดียวกัน
    profile = { category, title, ...clipStyle(), scare: resolveScare(process.env.CLIP_SCARE || loadConfig().script?.scare) }
    saveProfile(slug, profile)
    log(`   หมวดของคลิป: ${profile.category}${scareApplies(profile.category) ? ` · ความสยอง${SCARE_LEVELS[profile.scare].label}` : ''}`)
  }
  return profile
}
