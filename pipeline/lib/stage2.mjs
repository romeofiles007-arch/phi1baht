import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { projectDir, slugify, ROOT } from './config.mjs'
import { cleanScript } from './prompts.mjs'
import { estimateMinutes } from './segment.mjs'
import { readProfile } from './clip_profile.mjs'
import { paceOf } from '../../extension/prompts.js'

// ห่างจากเป้าเกินนี้ถือว่าต้องสั่งใหม่หรือแก้เองก่อนไปขั้นที่ 2
const TOLERANCE = 0.25

/**
 * บางครั้ง ChatGPT ไม่เขียนบท แต่ถามกลับเพื่อขอความชัดเจน เช่น
 *   "ข้อมูลบุคคลมีจุดที่ต้องยืนยันก่อนเขียน … ต้องการให้ใช้บุคคลใดเป็นตัวเอกครับ?"
 * ถ้าปล่อยผ่าน ระบบจะเอาคำถามนั้นไปพากย์ ทำซับ ทำภาพ 16 ใบ แล้วเรนเดอร์เป็นคลิปจริง
 * เกิดขึ้นแล้ว 19 พ.ย. 2026 — คลิป "หันสิน" ยาว 34 วินาที ที่เนื้อหาเป็นคำถามล้วน ๆ
 * และถูกตั้งเวลาโพสต์ขึ้นเพจเองต่อด้วย
 */
const ASK_BACK = [
  /ต้องการให้(ผม|ฉัน|เรา)?\s*(ใช้|เขียน|เล่า|ทำ|เลือก)/,
  /จะให้(ผม|ฉัน|เรา)?\s*(ใช้|เขียน|เล่า|ทำ|เลือก)/,
  /(โปรด|กรุณา|ช่วย)\s*(ระบุ|ยืนยัน|บอก|เลือก)/,
  /ต้องยืนยันก่อน|ขอยืนยัน(ข้อมูล)?ก่อน/,
  /แจ้ง(มา|กลับ)ได้เลย/,
  /which .*(would you like|do you want)|please (confirm|specify|clarify)|should i (use|write)/i,
]

/** บทที่ใช้ไม่ได้ → ข้อความบอกเหตุ · บทปกติ → null */
export function scriptProblem(script, { minutes, target } = {}) {
  const lines = String(script ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return 'บทว่างเปล่า'
  const last = lines.at(-1)
  const askBack = ASK_BACK.some((re) => re.test(script))
  // คลิปจบด้วยคำถามชวนคิดได้ (เช่น "แล้วคุณล่ะ จะเลือกอะไร?") จึงไม่ตัดสินจากเครื่องหมายคำถามอย่างเดียว
  if (askBack && /[?？]\s*$/.test(last)) return `ChatGPT ถามกลับแทนที่จะเขียนบท — บรรทัดสุดท้าย "${last.slice(0, 60)}"`
  if (askBack && lines.length <= 12) return `คำตอบเป็นการขอความชัดเจน ไม่ใช่บท — "${last.slice(0, 60)}"`
  if (Number.isFinite(minutes) && Number.isFinite(target) && target > 0 && minutes < target * 0.35) {
    return `บทสั้นผิดปกติ ~${minutes.toFixed(1)} นาที (เป้า ${target} นาที)`
  }
  return null
}

/**
 * บันทึกผล STAGE 2 (OUTPUT 2 — VO Script) ให้เป็นไฟล์ชุดเดียวกันทั้งจาก CLI และหน้า UI
 * ชื่อไฟล์ script_<slug>.txt ตาม Blueprint
 */
export function saveScript(config, title, raw) {
  const script = cleanScript(raw)
  const slug = slugify(title)
  const dir = projectDir(slug, 'script')
  const file = join(dir, `script_${slug}.txt`)

  writeFileSync(file, script, 'utf8')
  writeFileSync(join(dir, 'title.txt'), title, 'utf8')
  // ขั้นถัดไปต้องรู้ว่าสคริปต์เป็นภาษาอะไร เพื่อเลือก TTS engine ให้ถูก
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify(
      {
        title,
        slug,
        language: config.script.language,
        titleLanguage: config.script.titleLanguage,
        targetMinutes: config.script.targetMinutes,
      },
      null,
      2,
    ),
  )

  const length = lengthCheck(config, script, undefined, paceOf(readProfile(slug)))
  return { slug, file, script, ...length, problem: scriptProblem(script, length) }
}

/** pace: จังหวะของคลิป ('calm' = หมวด 1 อ่านช้า เว้นจังหวะ) — ใช้ประเมินความยาวให้ตรงกับเสียงจริง */
export function lengthCheck(config, script, target = config.script.targetMinutes, pace = 'normal') {
  const minutes = estimateMinutes(script, config.script.wordsPerMinute, pace)
  return { minutes, target, offTarget: Math.abs(minutes - target) > target * TOLERANCE }
}

/** สคริปต์ที่เคยเขียนไว้แล้วของหัวข้อนี้ — ไว้ให้หน้า UI เปิดกลับมาแล้วเห็นงานเดิม */
export function loadScript(config, title) {
  const slug = slugify(title)
  const dir = join(ROOT, 'projects', slug, '01_script')
  const file = join(dir, `script_${slug}.txt`)
  if (!existsSync(file)) return null
  const script = readFileSync(file, 'utf8')
  const meta = existsSync(join(dir, 'meta.json')) ? JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) : {}
  const length = lengthCheck(config, script, meta.targetMinutes, paceOf(readProfile(slug)))
  return { slug, file, script, language: meta.language, ...length, problem: scriptProblem(script, length) }
}
