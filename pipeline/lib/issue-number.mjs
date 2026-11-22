/**
 * เลขเล่ม "เล่มที่ N" บนปก — นับต่อเนื่องทุกคลิปเหมือนเลขเล่มของการ์ตูนเล่มละบาทจริง (spec 5.8)
 *
 *   projects/_issue_counter.json  { last: number }  (projects/ เป็นข้อมูลผู้ใช้ ไม่อยู่ใน git)
 *   เขียนแบบ atomic: เขียนไฟล์ชั่วคราวแล้ว rename ทับ · ไฟล์เสีย = เริ่มที่ 1 ไม่ throw
 *   เลขของคลิปเก็บใน profile.issue ตอนสร้าง profile ครั้งแรก → สั่งคลิปเดิมซ้ำได้เลขเดิม
 */
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './config.mjs'
import { readProfile } from './clip_profile.mjs'

export const ISSUE_COUNTER_FILE = '_issue_counter.json'

const counterFile = (root) => join(root, 'projects', ISSUE_COUNTER_FILE)

function readLast(file) {
  try {
    const last = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8'))?.last : 0
    return Number.isInteger(last) && last >= 0 ? last : 0
  } catch {
    return 0 // JSON พัง = เริ่มนับใหม่
  }
}

/** เลขเล่มถัดไป (เล่มแรก = 1) และบันทึกทันที */
export function nextIssueNumber(root = ROOT) {
  const file = counterFile(root)
  const next = readLast(file) + 1
  mkdirSync(join(root, 'projects'), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  try {
    writeFileSync(temp, JSON.stringify({ last: next }), 'utf8')
    renameSync(temp, file)
  } catch (error) {
    rmSync(temp, { force: true })
    throw error
  }
  return next
}

/** เลขเล่มของคลิป (จาก profile) — ยังไม่มี = null */
export function issueOf(slug) {
  const issue = readProfile(slug)?.issue
  return Number.isInteger(issue) && issue > 0 ? issue : null
}
