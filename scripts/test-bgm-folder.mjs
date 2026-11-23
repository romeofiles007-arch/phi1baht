// เพลงพื้นหลังจากโฟลเดอร์ music — ผู้ใช้วางไฟล์เอง (23 พ.ย. 2026: คีย์ Gemini เป็น Free Tier
// ซึ่งเรียกโมเดลเพลง Lyria ไม่ได้เลย — lyria-3-clip ได้ 0 token/นาที, lyria-3.5 ได้ 0 ครั้ง/วัน)
//   node --test scripts/test-bgm-folder.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BGM_AUDIO_EXT, BGM_DEFAULT_DIR, listBgmTracks, resolveBgm } from '../pipeline/lib/bgm.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('แผงข้างบอกชนิดไฟล์ครบตามที่ระบบรับจริง', () => {
  const hint = read('extension/sidepanel.js').split(/\r?\n/).find((l) => l.includes('ยังไม่มีเพลง'))
  assert.ok(hint, 'ไม่พบข้อความ "ยังไม่มีเพลง"')
  // เดิมบอกแค่ mp3 · wav · m4a คนวาง .ogg/.flac แล้วงงว่าทำไมไม่ขึ้น
  for (const ext of BGM_AUDIO_EXT) assert.ok(hint.includes(ext.slice(1)), `ข้อความต้องบอกชนิด ${ext}`)
  assert.ok(hint.includes(BGM_DEFAULT_DIR), 'ต้องบอกชื่อโฟลเดอร์')
})

test('อ่านเพลงทุกชนิดที่รับ รวมโฟลเดอร์ย่อย · ข้ามไฟล์ที่ไม่ใช่เพลง', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bgm-'))
  mkdirSync(join(dir, 'ghost'))
  for (const ext of BGM_AUDIO_EXT) writeFileSync(join(dir, `song${ext}`), 'x')
  writeFileSync(join(dir, 'ghost', 'creepy.mp3'), 'x')
  writeFileSync(join(dir, 'notes.txt'), 'x')
  writeFileSync(join(dir, '.gitkeep'), '')
  const tracks = listBgmTracks(dir)
  assert.equal(tracks.length, BGM_AUDIO_EXT.length + 1, 'นับเพลงในโฟลเดอร์ย่อยด้วย ไม่นับไฟล์อื่น')
  assert.ok(tracks.some((t) => t.endsWith('creepy.mp3')))
  assert.ok(!tracks.some((t) => t.endsWith('.txt') || t.endsWith('.gitkeep')))
})

test('โฟลเดอร์ว่าง (ยังไม่ได้วางเพลง) → ไม่มีเพลง พร้อมเหตุผลที่อ่านรู้เรื่อง ไม่ใช่ error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bgm-empty-'))
  writeFileSync(join(dir, '.gitkeep'), '')
  const { file, warning } = resolveBgm(dir, 'คลิป-1')
  assert.equal(file, null)
  assert.match(warning, /ไม่มีไฟล์เพลง/)
  // โฟลเดอร์ที่ไม่มีอยู่ (ไดรฟ์ไม่ได้เสียบ) ก็ต้องไม่ล้มทั้งงานตัดต่อ
  assert.equal(resolveBgm(join(dir, 'ไม่มีจริง'), 'คลิป-1').file, null)
  assert.equal(resolveBgm('', 'คลิป-1').file, null)
})

test('คลิปเดิมได้เพลงเดิมเสมอ · คลิปต่างกันไม่จำเป็นต้องเพลงเดียวกัน', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bgm-pick-'))
  for (const n of ['a', 'b', 'c', 'd', 'e']) writeFileSync(join(dir, `${n}.mp3`), 'x')
  const first = resolveBgm(dir, 'ผีกองกอย').file
  assert.equal(resolveBgm(dir, 'ผีกองกอย').file, first, 'ตัดต่อคลิปเดิมซ้ำต้องได้เพลงเดิม')
  const picks = new Set(['a', 'b', 'c', 'd', 'e'].map((s) => resolveBgm(dir, `คลิป-${s}`).file))
  assert.ok(picks.size > 1, 'คลิปต่างกันต้องไม่ได้เพลงเดียวกันหมด')
})

test('ตัดต่อวนเพลงให้เต็มคลิปและ fade — เพลง 30 วินาทีใช้กับคลิป 1 นาทีได้', () => {
  const ff = read('pipeline/lib/ffmpeg.mjs')
  assert.match(ff, /'-stream_loop', '-1', '-i', bgm/, 'ต้องวนเพลงซ้ำจนเต็มความยาวคลิป')
  assert.match(ff, /afade=t=in:d=1/)
  assert.match(ff, /afade=t=out/)
})
