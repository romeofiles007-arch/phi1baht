import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadConfig, slugify } from './config.mjs'
import { recentThemes, themeOf } from './topics.mjs'
import { characterFlowNote, bodyStyleRule, bodyStyleFlowNote, activeCharacter } from './character.mjs'
import { SHOT_VARIETY_RULE } from './continuity.mjs'
import { readProfile } from './clip_profile.mjs'
import { styleKitFiles } from './style-kit.mjs'

import * as shared from '../../extension/prompts.js'

export const { cleanScript, parseTopics, GENRES, opensWithHaveYouEver, endsWithLecture, endsCliffhanger, endsGeneric, tellsAsYou } = shared

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
  return shared.scriptPrompt(blueprint(config), title, { ...config.script, profile, scare: profile?.scare ?? clipScare(config), theme: themeOf(slugify(title)) })
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
${bodyStyleRule(activeCharacter(slug), readProfile(slug))}${shared.categoryRule(readProfile(slug), 'image') ? `\n${shared.categoryRule(readProfile(slug), 'image')}` : ''}
- Env ต้องเป็นฉากที่มีรายละเอียดตาม BACKGROUNDS ใน Style Bible (สถานที่ + ของประกอบฉาก 3–6 ชิ้น + แสง/บรรยากาศ + โทนสี) ห้ามเขียนแค่ "พื้นหลังสีเรียบ"
- แสงและโทนสีของ Env เลือกตาม COLOR MOOD ใน Style Bible ให้ตรงอารมณ์ของบรรทัดนั้น โดยใช้ชุดสีของหมวดคลิป (COLOR PALETTE) — ทุกภาพลงสีเต็ม
${imageLanguageRule(clipLanguage(config, slug))}`
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
 * ภาพ Style Kit ที่แนบให้ Flow (5_images.mjs แนบต่อท้ายรูปตัวละคร) — บอก agent ว่าเป็นแบบลายเส้นเท่านั้น ไม่ใช่ตัวละคร
 * characterCount = จำนวนรูปตัวละครหลักที่แนบก่อนหน้า (ให้บอกลำดับได้ชัด) · kit ว่าง = ไม่มีบรรทัดนี้
 */
export function styleKitFlowNote(categoryId, characterCount = 0) {
  const files = styleKitFiles(categoryId)
  if (!files.length) return ''
  const names = files.map((f) => f.file.split(/[\/]/).pop()).join(', ')
  const where = characterCount > 0 ? `รูปที่แนบลำดับที่ ${characterCount + 1}–${characterCount + files.length} (ท้ายสุด)` : `รูปที่แนบทั้ง ${files.length} รูป`
  return `${where} (${names}) เป็นภาพอ้างอิงลายเส้นเท่านั้น (Style Kit) — ใช้เป็นแบบเทคนิคเส้นหมึก การแรเงา และรอยสีไม้/สีน้ำ ไม่ใช่ตัวละคร: ห้ามวาดตัวละคร ฉาก หรือองค์ประกอบจากภาพเหล่านี้ลงในผลงาน · ห้ามเลียนโทนสีรวมหรือสีกระดาษของภาพอ้างอิง — ผลงานต้องสีสดบนกระดาษขาวสะอาด ขาวต้องขาว ไม่มีเหลืองคลุมทั้งภาพ${characterCount > 0 ? ` ตัวละครหลักคือ ${characterCount} รูปแรกเท่านั้น` : ''}`
}

/** ข้อความที่วางลง Flow — คำกำกับข้างบนตามที่ผู้ใช้ระบุในข้อ 5 ของสเปก */
export function flowPrompt(agentBrief, config = loadConfig(), slug = null) {
  const portrait = orientationOf(config) === 'portrait'
  const character = activeCharacter(slug)
  const profile = readProfile(slug)
  const charNote = characterFlowNote(character, profile)
  const kitNote = styleKitFlowNote(profile?.category, character?.images?.length ?? 0)
  return `สร้างรูป ตามนี้ อย่าลืม lock ตัวละครต่างๆ ด้วยนะ
เริ่มสร้างภาพทุกช็อตทันทีจนครบ ไม่ต้องสรุปแผน Storyboard และไม่ต้องถามยืนยันก่อน
${bodyStyleFlowNote(character, profile)}
${shared.artStyleOf(profile).flow}${charNote ? `\n${charNote}` : ''}${kitNote ? `\n${kitNote}` : ''}${portrait ? '\nทุกภาพเป็นแนวตั้ง 9:16 จัดองค์ประกอบแนวตั้ง ตัวละครอยู่กลางภาพ' : ''}
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
