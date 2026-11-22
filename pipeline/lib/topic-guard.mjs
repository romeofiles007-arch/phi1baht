/**
 * ตัวกันทำเรื่องซ้ำ — ฝั่งที่อ่านไฟล์ว่าช่องนี้ทำเรื่องอะไรไปแล้ว
 *
 * ตัวตัดสินทั้งหมด (เทียบชื่อ · prompt ตรวจเรื่องซ้ำ · อ่านผล · คัดหัวข้อ) อยู่ที่ extension/dedupe.js
 * ซึ่งเป็นโค้ดคิดล้วนๆ ไม่แตะไฟล์ — แผงข้างกับ pipeline จึงใช้กฎชุดเดียวกันทั้งสองทาง
 * ไฟล์นี้ re-export ให้ด้วย เพื่อให้ฝั่ง pipeline import ที่เดียวจบ
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './config.mjs'

export {
  GUARD_WINDOW,
  squash,
  similarity,
  NEAR_SAME,
  nearSame,
  localDuplicate,
  dedupePrompt,
  parseDedupe,
  screenTopics,
} from '../../extension/dedupe.js'

import { GUARD_WINDOW } from '../../extension/dedupe.js'

/**
 * เรื่องที่ทำ (หรือกำลังทำ) ล่าสุด ใหม่สุดก่อน: [{ slug, title, at, key, theme }]
 * คลิปที่เพิ่งเลือกหัวข้อแต่ยังไม่มี title.txt ก็นับ (อ่านจาก topics_scored.json) — กันสองรอบติดกันเลือกเรื่องเดียวกัน
 */
export function recentTopics(limit = GUARD_WINDOW, root = join(ROOT, 'projects')) {
  if (!existsSync(root)) return []
  const rows = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue
    const dir = join(root, entry.name, '01_script')
    const titleFile = join(dir, 'title.txt')
    const pickFile = join(dir, 'topics_scored.json')
    let chosen = null
    try { chosen = JSON.parse(readFileSync(pickFile, 'utf8'))?.chosen ?? null } catch {}
    let title = ''
    let at = 0
    try {
      title = readFileSync(titleFile, 'utf8').trim()
      at = statSync(titleFile).mtimeMs
    } catch {}
    if (!title && chosen?.title) {
      title = String(chosen.title).trim()
      try { at = statSync(pickFile).mtimeMs } catch {}
    }
    if (!title) continue
    rows.push({ slug: entry.name, title, at, key: chosen?.key ? String(chosen.key).trim() : null, theme: chosen?.theme ?? null })
  }
  return rows.sort((a, b) => b.at - a.at).slice(0, limit)
}
