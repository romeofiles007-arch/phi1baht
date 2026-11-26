import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadConfig, slugify } from './config.mjs'
import { recentThemes, themeOf } from './topics.mjs'
import { characterFlowNote, bodyStyleRule, bodyStyleFlowNote, activeCharacter, characterAttachments } from './character.mjs'
import { SHOT_VARIETY_RULE, WORLD_RICHNESS_RULE } from './continuity.mjs'
import { readProfile } from './clip_profile.mjs'
import { styleKitFiles, styleKitAttachments } from './style-kit.mjs'
import { productAttachment, readProduct, prominenceOf, productMatches } from './product.mjs'
import { castAttachments } from './cast.mjs'

import * as shared from '../../extension/prompts.js'

export const { cleanScript, parseTopics, GENRES, opensWithHaveYouEver, endsWithLecture, endsCliffhanger, endsGeneric, tellsAsYou, lacksReveal, stockPhrases, STOCK_PHRASES, productFromUrl, productRule, parseCasting, castingRule } = shared

/**
 * สินค้าที่ขอให้โผล่ในเรื่อง (ตัวทดลอง) — config.script.product = { url, name, enabled }
 * ชื่อจากลิ้ง Shopee ใช้เป็นค่าตั้งต้น ผู้ใช้แก้ชื่อทับได้ในแผงข้าง · ปิดอยู่ = ไม่ส่งไปใน prompt เลย
 */
export function clipProduct(config = loadConfig()) {
  const p = config.script?.product
  if (!p?.enabled) return null
  const name = p.name?.trim() || shared.productFromUrl(p.url)?.name || null
  if (!name) return null
  // คำบรรยายและรูปที่ ChatGPT เลือกใช้ได้เฉพาะเมื่อคลังรูปเป็นของสินค้าตัวนี้ — ไม่งั้นบทจะบอกหน้าตาของสินค้าตัวเก่า
  // (23 พ.ย. 2026: ชื่อเป็นนาฬิกาแต่คำบรรยายยังเป็นรองเท้าผ้าใบ)
  const own = productMatches(p.url)
  const { description, chosen } = own ? readProduct() : { description: '', chosen: null }
  return { name, url: p.url ?? '', enabled: true, prominence: prominenceOf(p.prominence), description, photo: chosen }
}

/** Blueprint คือแหล่งความจริงเดียวของกติกาทั้งหมด — ส่งไปทั้งฉบับทุกครั้ง ไม่สรุปย่อ */
export const BLUEPRINT_MARK = 'V1 ผี 1 บาท'
export function blueprint(config) {
  const text = readFileSync(join(ROOT, config.blueprint), 'utf8')
  // กันรันจากสำเนาเก่า/ไฟล์ Blueprint ของแอปอื่น แล้วได้บทผิดแนวทั้งคลิป
  if (!text.includes(BLUEPRINT_MARK)) throw new Error(`Blueprint ที่ ${config.blueprint} ไม่ใช่รุ่นผี 1 บาท (V1) — กำลังรันจากสำเนาเก่าอยู่หรือเปล่า`)
  return text
}

/** ระดับความสยองของคลิปนี้ ('light' | 'medium' | 'strong') — autopilot สุ่มไว้ใน CLIP_SCARE แล้ว ไม่งั้นตามตั้งค่าคลิป (สุ่มใหม่ทุกครั้งที่เรียก) */
export const clipScare = (config) => shared.resolveScare(process.env.CLIP_SCARE || config.script?.scare)

export function topicsPrompt(config) {
  return shared.topicsPrompt(blueprint(config), { titleLanguage: config.script.titleLanguage, genre: config.script.genre, scare: clipScare(config) })
}

export const { parseScoredTopics } = shared

/** หัวข้อพร้อมคะแนน — ชื่อหัวข้อใช้ภาษาเดียวกับเสียงพากย์ของคลิป */
export function scoredTopicsPrompt(config, { avoid = [], seen = [], themes } = {}) {
  return shared.scoredTopicsPrompt(blueprint(config), { titleLanguage: config.script.language, minutes: config.script.targetMinutes, avoid, seen, genre: config.script.genre, scare: clipScare(config), themes: themes ?? shared.pickThemes(shared.pickGenres(config.script.genre), recentThemes()) })
}

/** profile = โปรไฟล์ของคลิป (หมวด + ลายเส้น + ระดับความสยอง) จาก clip_profile.mjs — ไม่มี = ให้ ChatGPT ดูหมวดจากชื่อเรื่อง */
export function scriptPrompt(config, title, profile = null) {
  return shared.scriptPrompt(blueprint(config), title, { ...config.script, profile, scare: profile?.scare ?? clipScare(config), theme: themeOf(slugify(title)), product: clipProduct(config) })
}


/** ขั้นที่ 4 — ให้ AI เติม prompt ภาพลงในช่อง shot ที่เราคำนวณจังหวะมาแล้ว */
export function shotlistPrompt(config, { title, slots, timecodeText, slug }) {
  const table = slots
    .map((s) => `${s.filename} | SHOT ${String(s.shot).padStart(2, '0')} | ${s.duration}s | ${s.continuation ? '(ภาพต่อเนื่องจากช็อตก่อน)' : ''} ${s.narration}`)
    .join('\n')

  return `${blueprint(config)}

═══════════════════════════════════════
สร้าง OUTPUT 5 ให้ครบทั้ง 3 ส่วน สำหรับคลิปนี้:

หัวข้อ: "${title}"

Timecode Map:
${timecodeText}

ช่อง shot ที่คำนวณจังหวะมาแล้ว (${slots.length} ช็อต) — ห้ามเพิ่ม ห้ามลด ห้ามแก้ชื่อไฟล์:
${table}

ข้อกำหนดของ output:
- ตอบเป็นข้อความล้วนในแชต ห้ามใส่ code block ครอบทั้งคำตอบ อย่าสร้างไฟล์
- เรียงตามนี้: 5.1 Style Bible → 5.2 Character Bible → 5.3 Shot List
- ส่วน 5.3 ต้องขึ้นต้นด้วยบรรทัด "=== SHOT LIST ===" แล้วตามด้วย shot ทีละบรรทัด
- ทุก shot ขึ้นต้นด้วยชื่อไฟล์ที่ให้มาเป๊ะๆ ตามด้วย | คั่นแต่ละ field
- เว้น 1 บรรทัดว่างระหว่าง shot
- ช็อตที่กำกับว่า "ภาพต่อเนื่อง" ให้เป็น mini-sequence ของช็อตก่อนหน้า ไม่ใช่ฉากใหม่
- ใส่ pattern interrupt ทุก 15-30 วิ ตามกฎ 6
- ตัวละครทุกตัวต้องมี @TAG และห้ามเปลี่ยนรูปร่าง/สี/อุปกรณ์ข้ามช็อต
${SHOT_VARIETY_RULE}
${WORLD_RICHNESS_RULE}
${bodyStyleRule(activeCharacter(slug), readProfile(slug))}${shared.categoryRule(readProfile(slug), 'image') ? `\n${shared.categoryRule(readProfile(slug), 'image')}` : ''}
- Env ต้องเป็นฉากที่มีรายละเอียดตาม BACKGROUNDS ใน Style Bible (สถานที่ + ของประกอบฉาก 3–6 ชิ้น + แสง/บรรยากาศ + โทนสี) ห้ามเขียนแค่ "พื้นหลังสีเรียบ"
- แสงและโทนสีของ Env เลือกตาม COLOR MOOD ใน Style Bible ให้ตรงอารมณ์ของบรรทัดนั้น โดยใช้ชุดสีของหมวดคลิป (COLOR PALETTE) — ทุกภาพลงสีเต็ม
${imageLanguageRule(clipLanguage(config, slug))}${block(productShotRule(clipProduct(config)))}`
}

const block = (text) => (text ? `\n${text}` : '')

/**
 * ขอบขาว/กรอบกระดาษรอบภาพ — ผู้ใช้ (23 พ.ย. 2026) ส่งภาพจาก Flow มาถาม "แบบนี้ ห้ามทำกรอบได้ไหม"
 * กฎ full-bleed อยู่หัว prompt อยู่แล้ว แต่ Flow วาดภาพทีละช็อตและสนใจข้อความของช็อตนั้นมากที่สุด
 * (คลิปแรก 10 จาก 29 ช็อตออกมาเป็นภาพบนแผ่นกระดาษ → ต้องมีตัวตัดขอบตามเก็บ)
 * จึงต่อท้ายคำสั่งของ "ทุกช็อต" ด้วย ไม่ใช่บอกครั้งเดียวที่หัว
 */
export const FULL_BLEED_TAG = 'full-bleed edge to edge, no white border, no paper margin, no picture frame'
export const withFullBleed = (prompt) => {
  const text = String(prompt ?? '').trim()
  if (!text || text.includes(FULL_BLEED_TAG)) return text
  return `${text.replace(/[.,;·\s]+$/, '')} | ${FULL_BLEED_TAG}`
}

/**
 * สินค้าในภาพ (ตัวทดลอง) — ให้ Flow วาดสินค้าเป็นของในมือใน 2–3 ช็อต ไม่ใช่ภาพโฆษณา
 * ห้ามมีตัวหนังสือ/โลโก้บนตัวสินค้า: Blueprint กฎ 7 ห้ามตัวหนังสือในภาพ และโลโก้ยี่ห้อวาดออกมาเพี้ยนทุกครั้ง
 */
export function productShotRule(product) {
  const name = product?.name?.trim()
  if (!name) return ''
  const level = shared.PROMINENCE[shared.prominenceOf(product.prominence)]
  const look = product.description?.trim()
  return `- สินค้าในเรื่องคลิปนี้: "${name}" (${level.label} · ${level.shots})${look ? ` — หน้าตา: ${look}` : ''}
- ${level.rule} · เขียนตัวสินค้าลงใน field Action หรือ Chars พร้อมรูปทรงและสีให้ชัด ไม่ใช่แค่เอ่ยชื่อ
- ตัวสินค้าห้ามมีตัวหนังสือ โลโก้ ยี่ห้อ หรือ label ใดๆ (กฎ 7 ของ Blueprint) · วาดด้วยลายเส้นเล่มละบาทเหมือนของประกอบฉากชิ้นอื่น ไม่ใช่รูปถ่ายแปะลงไป`
}

/**
 * ตัดคำสั่ง "เว้นที่ว่างให้ซับไตเติล" ออกจาก prompt ภาพ — ถ้าส่งไป Flow จะวาดภาพมีแถบว่างด้านล่างทุกภาพ
 * (เคยใส่ไว้ในกฎแนวตั้ง ChatGPT จึงเขียนลงทั้ง Style Bible และทุกช็อต) ซับไตเติลมีกล่องพื้นทึบอยู่แล้ว ไม่ต้องเว้น
 */
export function stripSafeArea(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((line) => !/subtitle[- ]safe|reserve the (lower|bottom)|caption[- ]safe/i.test(line) || /^\d{2}_\d{2}_\d{2}|^cover\.png/i.test(line.trim()))
    .join('\n')
    .replace(/[,;]?\s*(?:with\s+)?(?:a\s+)?(?:clear|clean|empty|leave|keep)?\s*(?:the\s+)?(?:lower|bottom)\s+\d{1,2}\s*%\s*(?:of the frame\s*)?(?:as\s+)?(?:clean\s+|clear\s+|empty\s+)?(?:subtitle|caption)[- ]safe\s+(?:area|space|zone)(?:\s+with minimal visual clutter)?/gi, '')
    .replace(/[,;]?\s*(?:away from|avoid(?:ing)?)\s+(?:the\s+)?(?:bottom\s+)?(?:subtitle|caption)[- ]safe\s+(?:area|space|zone)/gi, '')
    // "lower 25% kept clear" · "keep the bottom 20% empty" · "leave lower third clear"
    .replace(/[,;]?\s*(?:(?:keep|leave)\s+)?(?:the\s+)?(?:lower|bottom)\s+(?:\d{1,2}\s*%|third|quarter)\s*(?:of the frame\s*)?(?:is\s+|kept\s+|left\s+|stays?\s+)?(?:clear|empty|clean|blank|open)(?:\s+for\s+(?:subtitles?|captions?|text))?/gi, '')
}

/** ภาษาของคลิป — ใช้ของ project (meta.json) ก่อน เพราะตั้งค่าอาจเปลี่ยนหลังเขียนบทแล้ว */
export function clipLanguage(config, slug) {
  const meta = slug ? join(ROOT, 'projects', slug, '01_script', 'meta.json') : null
  if (meta && existsSync(meta)) {
    const language = JSON.parse(readFileSync(meta, 'utf8')).language
    if (language) return language
  }
  return config.script.language
}

/**
 * ภาษาของคำอธิบายช็อต — ตามภาษาเสียงพากย์ของคลิป
 * ภาพในเรื่องไม่มีตัวหนังสือ (Blueprint กฎ 7) — ซับไตเติลและกล่องคำบรรยายใส่ตอนตัดต่อ · ปกเป็นภาพเดียวที่มีตัวหนังสือ
 */
export function imageLanguageRule(language) {
  const noText = '- ภาพในเรื่องไม่มีตัวหนังสือ: ห้ามสั่งให้มี on-screen text ลูกโป่งคำพูด คำเสียงประกอบ ป้าย หรือ label ในช็อตใดเลย (ซับไตเติลใส่ตอนตัดต่อ) — ตัวหนังสือมีได้เฉพาะภาพปก'
  if (language === 'en') return `- ภาษาในภาพ: English — เขียนคำอธิบายใน field (Env/Action/Frame) เป็นภาษาอังกฤษ\n${noText}`
  return `- ภาษาในภาพ: ไทย — เขียนคำอธิบายใน field (Env/Action/Frame) เป็นภาษาไทย แต่คงชื่อ field (SHOT, Chars, Env, Action, Frame) และ @TAG เป็นภาษาอังกฤษตามเดิม\n${noText}`
}

/** แนวภาพของคลิปใหม่: portrait 9:16 (ค่าตั้งต้นของ Blueprint และของแอป) | landscape 16:9 */
export function orientationOf(config = loadConfig()) {
  return config.render?.orientation === 'landscape' ? 'landscape' : 'portrait'
}
export const aspectOf = (config) => (orientationOf(config) === 'portrait' ? '9:16' : '16:9')

/** Blueprint ใช้ 9:16 เป็นค่าเริ่มต้น — คลิปแนวนอนต้องบอกให้ใช้ 16:9 แทน · แนวตั้งย้ำวิธีจัดองค์ประกอบ */
export function orientationRule(config = loadConfig()) {
  if (orientationOf(config) !== 'portrait') return '- คลิปนี้เป็นวิดีโอแนวนอน 16:9 — ใช้ ASPECT RATIO 16:9 แทนค่าเริ่มต้น 9:16 ใน Style Bible ของ Blueprint ทุกภาพเป็น 16:9'
  return `- คลิปนี้เป็นวิดีโอแนวตั้ง 9:16 (TikTok / Reels / Shorts) — ASPECT RATIO 9:16 ตาม Style Bible ของ Blueprint ทุกภาพเป็น 9:16
- จัดองค์ประกอบแนวตั้ง: ตัวละครและจุดสนใจอยู่กลางภาพ ฉากหลังต้องเต็มเฟรมถึงขอบทุกด้าน
- ห้ามเว้นพื้นที่ว่าง แถบสี ขอบขาว หรือโซน subtitle-safe ในภาพ และห้ามเขียนคำพวกนี้ลงใน prompt (ซับไตเติลมีกล่องพื้นทึบของตัวเองอยู่แล้ว)`
}

/**
 * รูปที่แนบไปกับคำสั่ง Flow — ทุกทางที่ส่งภาพให้ Flow ใช้ชุดนี้ (autopilot 5_images และแผงข้างแบบทำเองผ่าน /api/flow/attachments)
 *   character = รูปตัวละครของฉัน (ถ้ามี) · kit = ภาพ Style Kit ของหมวด (เฉพาะ kind 'scene' — ปกมีตัวหนังสือ ไม่แนบ)
 * flowPrompt บอก agent ตามรายการนี้ จึงไม่พูดถึงภาพที่ไม่ได้แนบ
 * shotsText = ข้อความช็อตของงานนี้ (เลือกแผ่นแบบเฉพาะตัวที่อยู่ในช็อตเหล่านี้) · ไม่ส่ง = ทุกช็อตของคลิป (agent_brief.txt)
 */
export function flowAttachmentParts(slug = null, categoryId = readProfile(slug)?.category, { shotsText } = {}) {
  // รูปสินค้าแนบเฉพาะตอนเปิดใช้สินค้าและ ChatGPT เลือกรูปไว้แล้ว — รูปเดียวเท่านั้น ไม่แนบทั้งกอง
  const product = clipProduct() ? productAttachment() : null
  // แผ่นแบบของตัวละครที่คลิปนี้เลือกจากคลัง (อ่านรหัส CAST: จาก Character Bible ของคลิป)
  const cast = pastable(clipCastAttachments(slug, { shotsText }))
  return {
    character: pastable(characterAttachments(activeCharacter(slug))),
    // ภาพ Style Kit เป็นฉากที่มีคนอยู่ในภาพ (หนุ่มถือตะเกียง · สาวเสื้อเหลือง) — Flow หยิบคนในภาพไปใส่ทุกเรื่อง
    // แม้คำสั่งจะห้ามแล้ว (ผู้ใช้ 23 พ.ย. 2026: "ใช้ 2 คนนี้ แนบไปตลอด เลยมีในทุกเรื่อง")
    // คลิปที่มีแผ่นแบบจากคลังแล้วไม่ต้องใช้ kit: แผ่นแบบวาดด้วยลายเส้นเดียวกัน และมีแต่คนที่เรื่องนี้ใช้จริง
    // kit แนบเฉพาะคลิปที่ไม่มีแผ่นแบบเลย (คลิปรุ่นเก่า / บทไม่ได้เลือกตัวละครจากคลัง) — ไม่งั้นไม่มีอะไรบอกลายเส้นเป็นภาพ
    kit: cast.length ? [] : pastable(styleKitAttachments(categoryId)),
    cast,
    product: pastable(product ? [product] : []),
  }
}

/**
 * ตัวละครที่คลิปนี้เลือกจากคลัง — ChatGPT เขียน [CAST:<id>] ไว้ใน Character Bible ตอนทำ Shot List
 * ที่อ่านจาก Bible ไม่ใช่เก็บเป็นสถานะแยก: Bible เป็นแหล่งความจริงเดียวอยู่แล้ว เขียนบทใหม่ก็ไม่ค้างค่าเก่า
 * แนบไม่เกิน 3 ตัว — แนบรูปเยอะคือสาเหตุที่ Flow สับสนตั้งแต่แรก
 */
/**
 * Character Bible ของคลิป — อ่านจากไฟล์คำตอบของ ChatGPT ตรงๆ
 * ไม่ import shotlist.mjs เพราะ shotlist.mjs import ไฟล์นี้อยู่ (วนกัน) · รหัส CAST: อยู่ในรอบแรกเสมอ
 */
function readBible(slug) {
  const dir = join(ROOT, 'projects', slug, '04_shotlist', 'rounds')
  if (!existsSync(dir)) return ''
  return readdirSync(dir)
    .filter((f) => f.endsWith('.txt'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n')
}

/** ข้อความช็อตทั้งหมดของคลิป (agent_brief.txt) — ใช้เมื่อผู้เรียกไม่ได้บอกว่างานนี้มีช็อตไหน */
function readClipShots(slug) {
  const file = join(ROOT, 'projects', slug, '04_shotlist', 'agent_brief.txt')
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

/** @TAG → รหัสคลัง จากบรรทัด "@hero = ชาญ ชายหนุ่ม... [CAST:man_young]" ใน Character Bible (ตัวแรกที่เจอชนะ) */
export function castTags(bible) {
  const out = new Map()
  for (const m of String(bible ?? '').matchAll(/^\s*(@\w+)\s*[=:：][^\n]*?\[?CAST:\s*([a-z][a-z0-9_]*)/gim)) {
    const member = shared.castById(m[2].toLowerCase())
    if (member && !out.has(m[1])) out.set(m[1], member.id)
  }
  return out
}

/** บรรทัดภาพในคำสั่ง (ชื่อไฟล์ .png ต้นบรรทัด) ที่มีช่อง Chars: */
const IMAGE_LINE = /^\S+\.png\b/
const charsField = (line) => /\bChars\s*:\s*([^|\n]*)/i.exec(line)?.[1] ?? null
/** @TAG ในช่อง Chars: ของบรรทัดช็อตเดียว */
export const shotCharTags = (line) => [...String(charsField(line) ?? '').matchAll(/@\w+/g)].map((m) => m[0])

/**
 * เลือกแผ่นแบบที่จะแนบ (ผู้ใช้ 26 พ.ย. 2026: "แนบตัวละครที่ไม่เกี่ยวข้องลงไปด้วยในบางฉาก ทำให้ Flow สับสน")
 * - แนบเฉพาะตัวที่โผล่ในช่อง Chars: ของช็อตในงานนี้ — ตัวที่มีแค่ใน Bible แต่ไม่อยู่ในช็อตไหนเลยไม่แนบ
 * - เกิน max เลือกตัวที่ออกหลายช็อตที่สุดก่อน (เท่ากันเรียงตาม Bible) — เดิมเอา 3 ตัวแรกของ Bible ตัวหลักอาจหลุด
 * - นับเฉพาะบรรทัด SHOT ไม่นับปก: แผงข้างขอรูป (ไม่มีปก) กับคำสั่ง Flow (มีปก) จะได้ชุดเดียวกัน
 * ช็อตไม่มีช่อง Chars: เลย (คลิปรุ่นเก่า) = ใช้แบบเดิม: ตาม Bible ไม่เกิน max
 */
export function castPlan(slug, shotsText = null, { max = 3 } = {}) {
  const empty = { attachments: [], tags: new Map(), perShot: false }
  if (!slug) return empty
  const bible = readBible(slug)
  if (!bible) return empty
  const order = parseCasting(bible)
  const tags = castTags(bible)
  const lines = String(shotsText ?? readClipShots(slug)).split('\n').filter((l) => IMAGE_LINE.test(l) && /\bSHOT\s*\d+/i.test(l))
  const counted = lines.filter((l) => charsField(l) !== null)
  if (!counted.length) return { ...empty, attachments: castAttachments(order, { max }) }
  const count = new Map()
  for (const line of counted) {
    for (const id of new Set(shotCharTags(line).map((t) => tags.get(t)).filter(Boolean))) count.set(id, (count.get(id) ?? 0) + 1)
  }
  const ranked = order.filter((id) => count.has(id)).sort((a, b) => count.get(b) - count.get(a) || order.indexOf(a) - order.indexOf(b))
  const names = tagNames(bible)
  const storyName = (id) => {
    const tag = [...tags].find(([, v]) => v === id)?.[0]
    return String(names[tag] ?? '').replace(/\s*\[?CAST:[^\]\s]*\]?/gi, '').trim().split(/\s+/)[0] || null
  }
  // ช็อตแรกของงานอาจไม่มีตัวใดมีแผ่นแบบเลย → ไม่แนบสักรูป (ไม่ใช่ย้อนไปแนบทั้ง Bible)
  return { attachments: castAttachments(ranked, { max }).map((a) => ({ ...a, storyName: storyName(a.castId) })), tags, perShot: true }
}

export function clipCastAttachments(slug, { max = 3, shotsText = null } = {}) {
  try {
    return castPlan(slug, shotsText, { max }).attachments
  } catch {
    return []
  }
}

/**
 * ต่อท้ายบรรทัดภาพแต่ละบรรทัดว่าใช้แผ่นแบบรูปไหน — Flow Agent รับรูปแนบครั้งเดียวทั้ง project แนบแยกรายช็อตไม่ได้
 * จึงผูกรูปกับช็อตด้วยคำสั่งแทน: ช็อตที่ไม่มีตัวนั้นต้องไม่เอาคนจากแผ่นแบบนั้นไปใส่
 * cast = แผ่นแบบที่แนบจริง (ลำดับเดียวกับที่แนบ) · before = จำนวนรูปที่แนบก่อนแผ่นแบบ
 */
export function annotateCastShots(text, cast = [], tags = new Map(), before = 0) {
  if (!cast.length) return text
  const index = new Map(cast.map((a, i) => [a.castId, { n: before + i + 1, name: a.storyName ?? a.castName }]))
  const range = `${before + 1}${cast.length > 1 ? `–${before + cast.length}` : ''}`
  return String(text).split('\n').map((line) => {
    if (!IMAGE_LINE.test(line) || charsField(line) === null) return line
    const refs = [...new Set(shotCharTags(line).map((t) => tags.get(t)).filter((id) => index.has(id)))].map((id) => index.get(id))
    if (!refs.length) return `${line} [แผ่นแบบ: ภาพนี้ไม่มีตัวละครจากแผ่นแบบรูปที่ ${range} — ห้ามวาดคนจากแผ่นแบบลงในภาพนี้ วาดเฉพาะตัวละครในช่อง Chars]`
    const others = cast.length - refs.length
    return `${line} [แผ่นแบบ: ${refs.map((r) => `รูปที่ ${r.n} = ${r.name}`).join(', ')}${others ? ` · ห้ามวาดตัวละครจากแผ่นแบบรูปอื่นลงในภาพนี้` : ''}]`
  }).join('\n')
}
/**
 * ด่านเดียวก่อนส่งรูปออกไป: ทิ้งรูปที่ส่วนขยายวางไม่ได้ (ไม่มี base64 หรือไม่มีชนิดไฟล์)
 * ส่วนขยายวางรูปด้วย atob(a.base64) ถ้าช่องนั้นหายไป มันจะ throw แล้วล้มทั้งรอบ ได้ภาพ 0 รูป
 * ทิ้งรูปเสียไปรูปเดียวแล้วได้ภาพครบ ดีกว่าแนบครบแล้วไม่ได้อะไรเลย — และ flowPrompt จะไม่พูดถึงรูปที่ทิ้งด้วย
 */
export const pastable = (list) => (list ?? []).filter((a) => a?.name && a.type && typeof a.base64 === 'string' && a.base64.length > 0)
/** รูปที่แนบทั้งหมดตามลำดับ: ตัวละคร → Style Kit → คลังตัวละคร → สินค้า (ลำดับเดียวกับที่ flowPrompt บอก agent) */
export function flowAttachments(slug = null, categoryId = readProfile(slug)?.category, { shotsText } = {}) {
  const { character, kit, cast, product } = flowAttachmentParts(slug, categoryId, { shotsText })
  return [...character, ...kit, ...cast, ...product]
}

/**
 * บอก agent ว่ารูปไหนคือตัวละครตัวไหน — คลังตัวละคร 48 ตัว (ผู้ใช้ 23 พ.ย. 2026: "ตัวละครมันมั่วสลับไปสลับมา")
 * ต้องผูกรูปกับ @TAG ให้ชัด ไม่งั้น Flow เห็นรูปคนหลายคนแล้วเอาหน้าไปสลับกันเองอยู่ดี
 * before = จำนวนรูปที่แนบก่อนหน้า (ตัวละครของฉัน + Style Kit)
 */
export function castFlowNote(cast = [], before = 0, { perShot = false } = {}) {
  if (!cast.length) return ''
  const lines = cast.map((a, i) => `  · รูปลำดับที่ ${before + i + 1} = ${a.storyName ? `${a.storyName} (${a.castName})` : a.castName}`)
  const perShotRule = perShot
    ? '\n- ท้ายบรรทัดของแต่ละภาพมี [แผ่นแบบ: ...] บอกว่าภาพนั้นใช้แผ่นแบบรูปไหน — วาดเฉพาะตัวละครที่ภาพนั้นระบุ ห้ามเอาคนจากแผ่นแบบรูปอื่นไปใส่ในภาพที่ไม่ได้ระบุ แม้จะแนบมาพร้อมกัน'
    : ''
  return `รูปที่แนบลำดับที่ ${before + 1}${cast.length > 1 ? `–${before + cast.length}` : ''} เป็นแผ่นแบบตัวละคร (แต่ละรูปมีคนคนเดียว วาดไว้ 3 ท่า บนพื้นขาว) — ใช้เป็นแบบหน้าตา ทรงผม ชุด และสีของตัวละครตัวนั้น:
${lines.join('\n')}
- ตัวละครที่ Character Bible กำกับรหัสคลังไว้ ให้วาดตามแผ่นแบบของตัวนั้นทุกช็อต — ห้ามเปลี่ยนทรงผม สีเสื้อ สีผ้านุ่ง หรือของติดตัว และห้ามสลับหน้าระหว่างตัวละคร
- แผ่นแบบเป็นแค่แบบของ "คน" ไม่ใช่ฉาก — ห้ามลอกพื้นขาวหรือการจัด 3 ท่าของแผ่นแบบไปใส่ในภาพของเรื่อง แต่ละภาพของเรื่องยังเป็นฉากเต็มเฟรมตามปกติ
- ตัวละครที่ไม่มีแผ่นแบบ ให้วาดตามคำบรรยายใน Character Bible เหมือนเดิม
- แผ่นแบบวาดด้วยลายเส้นที่ต้องการอยู่แล้ว — ใช้เป็นแบบเส้นหมึก การแรเงา และการลงสีของทั้งเรื่องด้วย ทั้งตัวละครและฉากหลัง${perShotRule}`
}

/**
 * บอก agent ว่ารูปสุดท้ายคือรูปสินค้าจริง ให้วาดสินค้าให้เหมือนรูปนี้ — ไม่ใช่ตัวละคร ไม่ใช่แบบลายเส้น
 * ที่ต้องบอกชัด: Flow เคยหยิบรูปอ้างอิงไปวาดเป็นตัวละครหรือเลียนโทนสีทั้งภาพมาแล้ว
 */
export function productFlowNote(product, before = 0) {
  // ต้องตัดสินด้วยด่านเดียวกับที่แนบจริง ไม่งั้นคำสั่งจะพูดถึงรูปที่ถูกทิ้งไป
  if (!product?.name || !pastable([productAttachment()]).length) return ''
  const look = product.description?.trim()
  return `รูปที่แนบลำดับที่ ${before + 1} (ท้ายสุด) เป็นรูปถ่ายสินค้าจริงชื่อ "${product.name}" — ใช้เป็นแบบของ "สิ่งของ" ชิ้นนี้เท่านั้น: วาดสินค้าในภาพการ์ตูนให้รูปทรง สัดส่วน และสีตรงกับรูปนี้ จนคนดูจำได้ว่าเป็นของชิ้นเดียวกัน${look ? ` (${look})` : ''}
- รูปนี้ไม่ใช่ตัวละคร ไม่ใช่ฉาก และไม่ใช่แบบลายเส้น — ห้ามวาดคน มือ พื้นหลังสตูดิโอ ตัวหนังสือ หรือโลโก้จากรูปนี้ลงในผลงาน ห้ามเลียนโทนสีของรูปนี้ไปทั้งภาพ
- วาดสินค้าด้วยลายเส้นการ์ตูนเล่มละบาทเหมือนของชิ้นอื่นในฉาก ไม่ใช่เอารูปถ่ายไปแปะ
- ห้ามวาดรูปนี้ใหม่ทั้งใบเป็นผลงานภาพไหนก็ตาม — ทุกภาพต้องเป็นฉากของเรื่อง สินค้าเป็นแค่ของชิ้นเล็กในฉาก
- ภาพปก (COVER) ห้ามใช้รูปนี้เป็นแบบ และไม่ต้องมีสินค้าชิ้นนี้ในปก — ปกวาดตามคำสั่งของปกเท่านั้น`
}

/**
 * ภาพ Style Kit ที่แนบให้ Flow (ต่อท้ายรูปตัวละคร) — บอก agent ว่าเป็นแบบลายเส้นเท่านั้น ไม่ใช่ตัวละคร
 * characterCount = จำนวนรูปตัวละครหลักที่แนบก่อนหน้า (ให้บอกลำดับได้ชัด) · kit ว่าง = ไม่มีบรรทัดนี้
 * attached = ชื่อภาพ kit ที่แนบจริง (flowPrompt ส่งจาก flowAttachmentParts) · ไม่ส่ง = ตามรายการใน kit.json
 */
export function styleKitFlowNote(categoryId, characterCount = 0, attached = null) {
  const files = attached ?? styleKitFiles(categoryId).map((f) => f.file.split(/[\\/]/).pop())
  if (!files.length) return ''
  const names = files.join(', ')
  const where = characterCount > 0 ? `รูปที่แนบลำดับที่ ${characterCount + 1}–${characterCount + files.length} (ท้ายสุด)` : `รูปที่แนบทั้ง ${files.length} รูป`
  return `${where} (${names}) เป็นภาพอ้างอิงลายเส้นเท่านั้น (Style Kit) — ใช้เป็นแบบเทคนิคเส้นหมึก การแรเงา และรอยสีไม้/สีน้ำ ไม่ใช่ตัวละคร: ห้ามวาดตัวละคร ฉาก หรือองค์ประกอบจากภาพเหล่านี้ลงในผลงาน · ห้ามเลียนโทนสีรวมหรือสีกระดาษของภาพอ้างอิง — ผลงานต้องสีสดบนกระดาษขาวสะอาด ขาวต้องขาว ไม่มีเหลืองคลุมทั้งภาพ${characterCount > 0 ? ` ตัวละครหลักคือ ${characterCount} รูปแรกเท่านั้น` : ''}`
}

/**
 * ข้อความที่วางลง Flow — คำกำกับข้างบนตามที่ผู้ใช้ระบุในข้อ 5 ของสเปก
 * castFrom = ข้อความช็อตทั้งงานที่ใช้เลือกแผ่นแบบ (ต้องตรงกับ flowAttachments ของงานเดียวกัน)
 *   ไม่ส่ง = ใช้ agentBrief เอง · คำสั่งซ้ำเฉพาะช็อตที่ขาดต้องส่งของทั้งงาน ไม่งั้นเลขรูปแนบจะเลื่อน
 */
export function flowPrompt(agentBrief, config = loadConfig(), slug = null, { castFrom = null } = {}) {
  const portrait = orientationOf(config) === 'portrait'
  const character = activeCharacter(slug)
  const profile = readProfile(slug)
  const charNote = characterFlowNote(character, profile)
  const shotsText = castFrom ?? agentBrief
  const attached = flowAttachmentParts(slug, profile?.category, { shotsText }) // ภาพที่แนบจริง — บอก agent เฉพาะภาพที่แนบไปเท่านั้น
  const kitNote = styleKitFlowNote(profile?.category, attached.character.length, attached.kit.map((a) => a.name))
  const castBefore = attached.character.length + attached.kit.length
  const plan = attached.cast.length ? castPlan(slug, shotsText) : null
  const perShot = !!plan?.perShot
  const castNote = castFlowNote(attached.cast, castBefore, { perShot })
  if (perShot) agentBrief = annotateCastShots(agentBrief, attached.cast, plan.tags, castBefore)
  const productNote = productFlowNote(clipProduct(config), attached.character.length + attached.kit.length + attached.cast.length)
  return `สร้างรูป ตามนี้ อย่าลืม lock ตัวละครต่างๆ ด้วยนะ
เริ่มสร้างภาพทุกช็อตทันทีจนครบ ไม่ต้องสรุปแผน Storyboard และไม่ต้องถามยืนยันก่อน
${bodyStyleFlowNote(character, profile)}
${shared.artStyleOf(profile).flow}${charNote ? `\n${charNote}` : ''}${kitNote ? `\n${kitNote}` : ''}${castNote ? `\n${castNote}` : ''}${productNote ? `\n${productNote}` : ''}${portrait ? '\nทุกภาพเป็นแนวตั้ง 9:16 จัดองค์ประกอบแนวตั้ง ตัวละครอยู่กลางภาพ' : ''}
ทุกภาพต้องเต็มเฟรม ฉากหลังยาวถึงขอบทุกด้าน ห้ามมีแถบว่าง ขอบขาว หรือพื้นที่เปล่าด้านบน/ล่าง
${shared.FULL_BLEED_RULE}
${shared.categoryColorRule(profile?.category)}
ทุกภาพเป็นภาพสี ลงสีเต็มทั้งตัวละครและฉากหลัง — ห้ามภาพขาวดำ โทนเทา หมึกสีเดียว หรือลายเส้นไม่ลงสีเด็ดขาด
ตั้งชื่อแต่ละภาพเป็นชื่อไฟล์ที่อยู่หน้าบรรทัดของ shot นั้นเป๊ะๆ เช่น "00_00_00.png SHOT 01"
ชื่อไฟล์ เลข SHOT และ @TAG ใช้ตั้งชื่อภาพเท่านั้น ห้ามเขียนลงในภาพ
@TAG (เช่น @main @crowd1) เป็นชื่อเรียกตัวละครในคำสั่งเท่านั้น ห้ามวาดป้ายชื่อ ตัวอักษร @ หรือชื่อตัวละครลอยเหนือหัว/บนตัวละครเด็ดขาด

${agentBrief}

ย้ำ: ทุกภาพลงสีเต็ม ห้ามขาวดำ/โทนเทา · ภาพในเรื่อง (SHOT LIST) ห้ามมีตัวหนังสือ ลูกโป่งคำพูด คำเสียงประกอบ ป้าย ป้ายชื่อ @TAG หรือชื่อตัวละครในภาพเด็ดขาด (ซับไตเติลใส่ตอนตัดต่อ) — ตัวหนังสือมีได้เฉพาะภาพปก (COVER) ตามที่ปกสั่งไว้เท่านั้น`
}

/** แยก shot list ออกจาก OUTPUT 5 แล้วจับคู่กับช่อง shot ที่เราคำนวณไว้ */
export function parseShotList(text, slots) {
  const byFilename = new Map()
  // ChatGPT อาจใส่ bullet / เลขข้อ / ตัวหนา หน้าชื่อไฟล์ — ยอมรับได้ ขอแค่ชื่อไฟล์อยู่ต้นบรรทัด
  for (const m of text.matchAll(/^(?:[ \t>*•-]+|\d+[.)][ \t]+)?\**(\d{2}_\d{2}_\d{2}(?:_\d)?\.png)\**[ \t:]*(.*)$/gm)) {
    if (m[2].trim()) byFilename.set(m[1], m[2].trim())
  }
  const matched = slots.map((s) => ({ ...s, prompt: byFilename.get(s.filename) ?? null }))
  return { shots: matched, missing: matched.filter((s) => !s.prompt).map((s) => s.filename) }
}

/**
 * ชื่อเรียกของ @TAG จาก Character Bible ("@crowd1 = นักศึกษาหญิงในห้อง")
 * ตัดคำพูดและส่วน "แทน …" ออก ("ตัวละครหลักแทน “คุณ”" → "ตัวละครหลัก") ไม่ให้กลายเป็นข้อความในภาพ
 */
export function tagNames(bible) {
  const names = {}
  for (const m of String(bible).matchAll(/^\s*(@\w+)\s*[=:：]\s*(.+)$/gm)) {
    const name = m[2].replace(/["“”'‘’「」]/g, '').replace(/\s*แทน.*$/, '').trim()
    if (name && !names[m[1]]) names[m[1]] = name
  }
  return names
}

/**
 * Flow วาด @TAG ในคำบรรยายฉากเป็นป้ายชื่อบนหัวตัวละคร (เจอ "@crowd1" ลอยทุกภาพ ก.ย. 2026)
 * — ในช่อง Env/Action/Frame เปลี่ยน @TAG เป็นชื่อเรียกจาก Bible · ช่อง Chars: คง @TAG ไว้ให้ Flow lock ตัวละคร
 */
export function untagShotPrompt(prompt, names) {
  return String(prompt)
    .split(' | ')
    .map((field) => (/^\s*Chars\s*:/i.test(field) ? field : field.replace(/@\w+/g, (tag) => names[tag] ?? tag.slice(1))))
    .join(' | ')
}

/**
 * โทนเทา/หม่นในคำบรรยายฉากทำให้ Flow วาดภาพเกือบขาวดำ (เจอ ก.ย. 2026: "โทนน้ำเงินเทา" "ฟ้าเทาหม่น")
 * แก้เฉพาะคำบรรยายฉากและโทนสี — สีเสื้อผ้าตัวละคร ("เบลเซอร์สีเทา") ไม่แตะ
 */
export function recolorScene(text) {
  return String(text)
    .replace(/(ฟ้า|น้ำเงิน|ครีม|เขียว|ม่วง|ฟ้าอ่อน)เทา/g, '$1')
    .replace(/เทาหม่น|หม่นหมอง/g, 'เข้มอิ่ม')
    .replace(/โทน(สี)?เทา/g, 'โทน$1ฟ้าเข้ม')
    .replace(/หม่น(ลง)?/g, 'เข้มขึ้น')
    .replace(/ขาวดำ|monochrome|grayscale|greyscale|black and white/gi, 'ลงสีสด')
}
/** ใช้กับบรรทัดใน Style Bible ที่พูดถึงฉากหลัง/โทนสี/บรรยากาศ และช่อง Env/Frame ของ shot */
export function recolorBrief(bible) {
  return String(bible).split(/\r?\n/).map((line) => (/ฉากหลัง|โทน|บรรยากาศ|background|palette/i.test(line) ? recolorScene(line) : line)).join('\n')
}
export function recolorShotPrompt(prompt) {
  return String(prompt).split(' | ').map((f) => (/^\s*(Env|Frame)\s*:/i.test(f) ? recolorScene(f) : f)).join(' | ')
}
