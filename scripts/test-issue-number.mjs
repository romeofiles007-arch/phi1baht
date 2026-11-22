// เลขเล่ม "เล่มที่ N" บนปก + น้ำเสียงตั้งต้น (ผู้ชายทุ้ม เล่าช้า ชวนขนลุก)
//   node --test scripts/test-issue-number.mjs
import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const { nextIssueNumber, issueOf } = await import('../pipeline/lib/issue-number.mjs')
const { coverBriefLines, coverRequest } = await import('../pipeline/lib/cover.mjs')
const { PACE } = await import('../extension/prompts.js')
const { geminiPrompt, edgeRate } = await import('../pipeline/lib/cloud_tts.mjs')

const tmpRoots = []
const newRoot = () => { const r = mkdtempSync(join(tmpdir(), 'issue-')); tmpRoots.push(r); return r }
after(() => { for (const r of tmpRoots) rmSync(r, { recursive: true, force: true }) })

test('โฟลเดอร์ว่าง: เล่มแรก = 1 แล้ว 2 · เขียนลง projects/_issue_counter.json ไม่ทิ้งไฟล์ชั่วคราว', () => {
  const root = newRoot()
  assert.equal(nextIssueNumber(root), 1)
  assert.equal(nextIssueNumber(root), 2)
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'projects', '_issue_counter.json'), 'utf8')), { last: 2 })
  assert.deepEqual(readdirSync(join(root, 'projects')), ['_issue_counter.json'])
})

test('ไฟล์ตัวนับเสีย (JSON พัง / ค่าไม่ใช่เลข) → เริ่มที่ 1 ไม่ throw', () => {
  const root = newRoot()
  mkdirSync(join(root, 'projects'))
  writeFileSync(join(root, 'projects', '_issue_counter.json'), '{ broken')
  assert.equal(nextIssueNumber(root), 1)
  writeFileSync(join(root, 'projects', '_issue_counter.json'), JSON.stringify({ last: 'x' }))
  assert.equal(nextIssueNumber(root), 1)
  assert.equal(nextIssueNumber(root), 2)
})

test('ปกใส่ "เล่มที่ N" จาก profile.issue · ไม่มีเลข = ไม่มีบรรทัดเล่มที่', () => {
  const shot = { filename: 'cover.png', shot: 'COVER', prompt: 'COVER | Chars: @main', language: 'th', title: 'กระสือเคาะประตู', category: 'ghost', issue: 7 }
  assert.match(coverBriefLines(shot, true).join('\n'), /เล่มที่ 7/)
  assert.ok(!/เล่มที่ \d/.test(coverBriefLines({ ...shot, issue: null }, true).join('\n')))
  assert.match(coverRequest(true, 'th', 'ghost', 12), /เล่มที่ 12/)
})

test('issueOf: คลิปที่ไม่มี profile = null', () => {
  assert.equal(issueOf('slug-ที่ไม่มีอยู่จริง-xyz'), null)
})

test('น้ำเสียงตั้งต้น: ผู้ชายทุ้ม ช้า ชวนขนลุก — ElevenLabs tag / Gemini instruction / Edge rate -10% pitch -8Hz', () => {
  assert.match(PACE.calm.eleven.tag, /deep/i)
  assert.match(PACE.calm.eleven.tag, /eerie/i)
  assert.equal(PACE.calm.edge.rate, '-10%')
  assert.equal(PACE.calm.edge.pitch, '-8Hz')
  const g = geminiPrompt('สวัสดี', { emotion: PACE.calm.gemini.emotion, speed: 0.85 })
  assert.match(g, /deep/i)
  assert.match(g, /male/i)
  assert.match(g, /eerie|chilling/i)
  assert.equal(edgeRate(0.85, '-10%'), '-10%')
  assert.equal(edgeRate(0.85), '-15%')
})

test('music/ ไม่มีเพลงที่แถมมา (ผู้ใช้ใส่ mp3 เอง)', () => {
  const dir = join(import.meta.dirname, '..', 'music')
  const tracks = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f)) : []
  assert.deepEqual(tracks, [])
})
