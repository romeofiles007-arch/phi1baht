/**
 * ภาพปกคลิป — Blueprint OUTPUT 4 "Thumbnail (ภาพปกแบบปกการ์ตูนเล่มละบาท)" · ภาพแรกของคลิปและภาพตัวอย่างบน TikTok
 *
 *   ChatGPT: เขียน prompt ปกมาพร้อม Shot List รอบแรก (บรรทัด cover.png | COVER | ...)
 *   Flow:    สร้างเป็นภาพสุดท้ายหลังครบทุกช็อต ตั้งชื่อ "cover.png COVER" แนวเดียวกับคลิป
 *   ไฟล์:    05_images/cover.png (ขั้นตัดต่อไม่ใช้ — ไม่ใช่ชื่อ timecode) · 04_shotlist/cover.txt เก็บ prompt
 *
 * แบบปก (spec 5.4 จากปกเล่มจริง): เส้นหมึกดำลงสีไม้/สีน้ำสีสด · ตัวละครครึ่งตัวใหญ่ด้านหน้า ฉากเล็กด้านหลัง
 *   · ชื่อเรื่องตัวหนาแดง (ม่วง/เขียว) · แถบลายเฉียงแดง–น้ำเงินขอบบน · โลโก้ "ผี 1 บาท" ซ้ายบน · ป้าย "1 บาท" ขวาล่าง
 *   โลโก้เป็นของเราเอง ห้ามเลียนโลโก้สำนักพิมพ์จริง (ตัว "N" ของนครไทย) · ปกเป็นภาพเดียวที่มีตัวหนังสือได้
 *
 * project เก่าที่ไม่มี prompt ปก → ให้ agent ออกแบบปกเองจากชื่อเรื่อง + Style/Character Bible
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectDir, loadConfig } from './config.mjs'
import { stripSafeArea, clipLanguage } from './prompts.mjs'
import { readProfile } from './clip_profile.mjs'

export const COVER_LOGO = 'ผี 1 บาท'

/** ชุดสีของปกตามหมวด — ปกผี/ไสยโทนมืดกว่าเล่มอื่น · ไม่รู้หมวด = บอกทั้งสองแบบให้เลือกตามเรื่อง */
function coverPalette(category) {
  const dark = 'ปกหมวดผี/ไสยศาสตร์โทนมืดกว่าเล่มอื่น: แดงเลือด เขียวป่า ม่วงกลางคืน บนพื้นเข้ม ชื่อเรื่องแดงหรือเหลืองตัดขอบดำ'
  const bright = 'ปกหมวดนิทาน/ดราม่า/ตลกโทนสว่าง: เหลือง ชมพู ฟ้า เขียว แดง พื้นหลังเหลืองหรือฟ้าอ่อน'
  if (category === 'ghost' || category === 'saiyasat') return dark
  if (category) return bright
  return `${dark} · ${bright}`
}

/**
 * สูตรปกแบบปกการ์ตูนเล่มละบาท — ใช้ทั้งตอนขอ prompt จาก ChatGPT และตอนสั่ง Flow วาด
 * (ปกเก่าที่ prompt เขียนว่า "ไม่มีตัวอักษร" ก็ได้สูตรนี้ตอนสร้างปกใหม่)
 */
function coverRules(language, category) {
  const th = language !== 'en'
  return [
    'วาดแบบปกการ์ตูนเล่มละบาทไทยยุค 2520: เส้นหมึกดำแล้วลงสีไม้หรือสีน้ำสีสด เห็นรอยสีและเนื้อกระดาษ ลายเส้นและตัวละครเดียวกับ Style Bible และ Character Bible',
    'ผีหรือตัวละครหลักครึ่งตัวขนาดใหญ่อยู่ด้านหน้า (ราวครึ่งภาพ) อารมณ์ชัด · มีฉากเล็กอยู่ด้านหลังที่บอกเรื่อง (คนวิ่งหนีกลางทุ่ง เรือนไทยใต้แสงจันทร์ ต้นตะเคียน ศาลาริมทาง)',
    'ขอบบนสุดของภาพมีแถบลายเฉียงสีแดงสลับน้ำเงินพาดตลอดความกว้าง',
    `โลโก้ "${COVER_LOGO}" อยู่มุมซ้ายบนใต้แถบลายเฉียง เป็นกรอบป้ายเล็กสีสดเขียนว่า "${COVER_LOGO}" ตัวหนา — เป็นโลโก้ของเราเอง ห้ามเลียนโลโก้สำนักพิมพ์จริง ห้ามมีตัว "N" หรือชื่อสำนักพิมพ์ใดๆ`,
    `ชื่อเรื่อง${th ? 'ภาษาไทย สะกดถูกต้องทุกตัว' : 'ภาษาอังกฤษ'} ตัวหนาใหญ่สีแดง (หรือม่วง/เขียว) แบบตัวเขียนมือ ตัดขอบเข้ม วางช่วงบนของภาพถัดจากโลโก้ ใส่ข้อความในเครื่องหมายคำพูด`,
    'ป้ายสี่เหลี่ยมเล็ก "1 บาท" อยู่มุมขวาล่าง (เลข 1 ตัวใหญ่ คำว่า บาท ตัวเล็กใต้เลข)',
    `ลูกโป่งคำพูดเขียนมือได้ 1 อัน คำสั้นๆ ${th ? 'ภาษาไทย' : 'ภาษาอังกฤษ'} ที่ชวนสงสัย (ไม่บังคับ)`,
    'ตัวหนังสือทุกตัวอยู่ในภาพครบ เว้นจากขอบภาพ ไม่ล้นหรือถูกตัดขอบ และไม่ทับหน้าตัวละคร',
    coverPalette(category),
    'หน้าผีบนปกน่ากลัวแบบเล่มละบาท (ตาโปน ฟันเรียง ผมกระเซิง) แต่ไม่เปลือย ไม่มีไส้ ไม่มีบาดแผล เลือดแค่หยดเล็กน้อย · ชวนสงสัยแต่ตรงกับเนื้อหาจริง อ่านรู้เรื่องแม้เห็นภาพเล็กบนมือถือ',
  ]
}

export const COVER_NAME = 'cover.png'
export const coverPath = (slug) => join(projectDir(slug, 'images'), COVER_NAME)
const promptFile = (slug) => join(projectDir(slug, 'shotlist'), 'cover.txt')

/** กฎสำหรับ ChatGPT รอบแรก — ขอ prompt ปกต่อท้าย Shot List */
export function coverRequest(portrait, language = 'th', category = null) {
  return `- ท้ายคำตอบ เพิ่มบรรทัดว่าง แล้วบรรทัด "=== COVER ===" ตามด้วย prompt ภาพปกคลิป 1 บรรทัด ขึ้นต้นด้วย "cover.png | COVER |" (Thumbnail ตาม OUTPUT 4 — เลือกคอนเซปต์ที่ดีที่สุดแบบเดียว)
- ภาพปก = ปกการ์ตูนเล่มละบาท ${portrait ? 'แนวตั้ง 9:16' : 'แนวนอน 16:9'} ใช้เป็นภาพแรกของคลิปและภาพตัวอย่างบน TikTok — ภาพปกเป็นภาพเดียวที่มีตัวหนังสือได้:
${coverRules(language, category).map((r) => `  · ${r}`).join('\n')}
- รูปแบบ field ของปก: Chars: @TAG | Env: ... | Action: ... | Frame: ... (คำอธิบายเป็น${language === 'en' ? 'ภาษาอังกฤษ' : 'ภาษาไทย'} คงชื่อ field และ @TAG ตามเดิม)`
}

/** ดึง prompt ปกจากคำตอบของ ChatGPT */
export function parseCover(text) {
  const m = /^(?:[ \t>*•-]+)?\**cover\.png\**[ \t:|]*(.+)$/im.exec(text)
  return m?.[1]?.trim() || null
}

export function saveCoverPrompt(slug, prompt) {
  if (prompt) writeFileSync(promptFile(slug), prompt, 'utf8')
}

export function readCoverPrompt(slug) {
  return existsSync(promptFile(slug)) ? readFileSync(promptFile(slug), 'utf8').trim() || null : null
}

export const hasCover = (slug) => existsSync(coverPath(slug))

/** "ช็อต" ปกสำหรับส่งให้ Flow — ไม่มี prompt จาก ChatGPT ก็ให้ agent ออกแบบเอง */
export function coverShot(slug, title) {
  const saved = readCoverPrompt(slug)
  const prompt =
    (saved && stripSafeArea(saved).trim()) ||
    `COVER | ภาพปกคลิปแบบปกการ์ตูนเล่มละบาท ของเรื่อง "${title}" — ออกแบบเองจากเนื้อเรื่องและ Character Bible`
  // prompt ปกรุ่นก่อนห้ามตัวอักษร — ตัดออก ปกแบบเล่มละบาทมีชื่อเรื่อง โลโก้ และป้ายราคา
  const cleaned = prompt.replace(/[,;·]?\s*(?:ไม่มีตัวอักษรในภาพ|ไม่มีตัวหนังสือ(?:ในภาพ)?|no (?:text|letters|words)(?: in (?:the )?image)?)/gi, '').trim()
  return { filename: COVER_NAME, shot: 'COVER', prompt: cleaned, language: clipLanguage(loadConfig(), slug), title, category: readProfile(slug)?.category ?? null }
}

/** ส่วนท้ายของ brief ที่ส่งให้ Flow */
export function coverBriefLines(shot, portrait) {
  return [
    `=== COVER (สร้างเป็นภาพสุดท้าย หลังครบทุกช็อต) ===`,
    `${shot.filename} ${shot.prompt} | ภาพปกคลิปแบบปกการ์ตูนเล่มละบาท ${portrait ? 'แนวตั้ง 9:16' : 'แนวนอน 16:9'} ของเรื่อง "${shot.title ?? ''}" — ภาพนี้ภาพเดียวที่มีตัวหนังสือได้ · ${coverRules(shot.language, shot.category).join(' · ')} · ตั้งชื่อภาพ "cover.png COVER" (ชื่อไฟล์ไม่ต้องเขียนลงในภาพ)`,
  ]
}
