// ค่าใช้จ่ายต่อคลิป: เสียงพากย์ต้องถูกนับด้วย และดูยอดของทุกคลิปได้
//   node --test scripts/test-usage-tts.mjs
// ผู้ใช้ 23 พ.ย. 2026 ส่งภาพโควตา ElevenLabs (ใช้ไป 80,267 จาก 104,870 เครดิต) แล้วขอว่า
// "อยากให้บอกด้วยว่าทุกคลิป ใช้ token ไปเท่าไร" — เดิมนับแต่ token ChatGPT กับเครดิต Kie
// เสียงพากย์ซึ่งกินเครดิตมากที่สุดไม่เคยถูกนับเลย
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, readFileSync as read2 } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { recordTtsUsage, estimateTokens, allClipUsage, ELEVEN_CREDITS_PER_CHAR } from '../pipeline/lib/usage.mjs'

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const usageFile = () => join(mkdtempSync(join(tmpdir(), 'usage-')), 'usage.json')
const readBack = (f) => JSON.parse(read2(f, 'utf8'))

test('ElevenLabs: นับเครดิตตามจำนวนตัวอักษร', () => {
  const f = usageFile()
  recordTtsUsage({ engine: 'elevenlabs', model: 'eleven_multilingual_v2', chars: 1200, segments: 9, voice: 'เสียงของเรา' }, f)
  const { tts } = readBack(f)
  assert.equal(tts.chars, 1200)
  assert.equal(tts.credits, 1200, 'รุ่นปกติ 1 เครดิต/ตัวอักษร')
  assert.equal(tts.segments, 9)
  assert.equal(tts.engine, 'elevenlabs')
})

test('รุ่น turbo/flash คิดครึ่งราคา', () => {
  assert.equal(ELEVEN_CREDITS_PER_CHAR.eleven_turbo_v2_5, 0.5)
  const f = usageFile()
  recordTtsUsage({ engine: 'elevenlabs', model: 'eleven_flash_v2_5', chars: 1000, segments: 5 }, f)
  assert.equal(readBack(f).tts.credits, 500)
})

test('engine ที่ไม่เสียเงิน: จดตัวอักษรไว้ แต่เครดิตเป็น 0', () => {
  for (const engine of ['edge', 'gemini', 'voxcpm']) {
    const f = usageFile()
    recordTtsUsage({ engine, chars: 900, segments: 4 }, f)
    const { tts } = readBack(f)
    assert.equal(tts.credits, 0, `${engine} ไม่หักเครดิต`)
    assert.equal(tts.chars, 900, `${engine} ยังจดตัวอักษรไว้ให้รู้ขนาดงาน`)
  }
})

test('ทำเสียงใหม่ซ้ำ = บวกเพิ่ม ไม่ใช่ทับของเดิม (เครดิตที่จ่ายไปแล้วไม่คืน)', () => {
  const f = usageFile()
  recordTtsUsage({ engine: 'elevenlabs', chars: 500, segments: 3 }, f)
  recordTtsUsage({ engine: 'elevenlabs', chars: 700, segments: 4 }, f)
  const { tts } = readBack(f)
  assert.equal(tts.chars, 1200)
  assert.equal(tts.runs, 2)
  assert.equal(tts.credits, 1200)
})

test('ไม่มีไฟล์ปลายทาง หรือไม่มีตัวอักษร = ไม่จดอะไร ไม่ล้ม', () => {
  assert.doesNotThrow(() => recordTtsUsage({ engine: 'elevenlabs', chars: 100 }, undefined))
  const f = usageFile()
  recordTtsUsage({ engine: 'elevenlabs', chars: 0 }, f)
  assert.throws(() => readBack(f), 'ไม่มีตัวอักษร = ไม่สร้างไฟล์')
})

test('ขั้นทำเสียงจดลงไฟล์ของคลิปจริง (ไม่พึ่ง env ที่อาจไม่ได้ตั้ง)', () => {
  const tts = src('pipeline/2_tts.mjs')
  assert.match(tts, /import \{ recordTtsUsage \} from '\.\/lib\/usage\.mjs'/)
  assert.match(tts, /recordTtsUsage\(/)
  assert.match(tts, /chars: segments\.reduce\(\(n, s\) => n \+ s\.text\.length, 0\)/)
  assert.match(tts, /join\(ROOT, 'projects', slug, 'usage\.json'\)/, 'ส่ง path ของคลิปไปตรงๆ')
})

test('clipCost คืนยอดเสียงพากย์ให้แผงข้าง · แผงข้างมีบรรทัดเสียง', () => {
  const usage = src('pipeline/lib/usage.mjs')
  assert.match(usage, /tts: tts && \{ engine: tts\.engine/)
  assert.match(usage, /paid: \(tts\.credits \?\? 0\) > 0/)
  const panel = src('extension/sidepanel.js')
  assert.match(panel, /เสียงพากย์: ยังไม่ได้ทำเสียงของคลิปนี้/)
  assert.match(panel, /เครดิต · \$\{fmtNum\(tts\.chars\)\} ตัวอักษร/)
  // บรรทัดเดิมที่บอกว่า "เสียงทำในเครื่อง" ใช้ไม่ได้แล้ว เพราะอาจเป็น ElevenLabs
  assert.ok(!/Google Flow 0 credits · เสียงทำในเครื่อง/.test(panel))
})

test('ยอดของทุกคลิป: อ่านได้ เรียงคลิปใหม่สุดก่อน และข้ามโฟลเดอร์ระบบ', () => {
  const rows = allClipUsage()
  assert.ok(Array.isArray(rows))
  for (const r of rows) {
    assert.ok(!r.slug.startsWith('_'), 'ข้ามโฟลเดอร์ระบบ (_previews ฯลฯ)')
    assert.equal(typeof r.tokens, 'number')
    assert.equal(typeof r.ttsCredits, 'number')
  }
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].at >= rows[i].at, 'เรียงใหม่→เก่า')
  // bridge เปิดทางให้แผงข้างอ่าน
  const ui = src('bridge/ui.js')
  assert.match(ui, /url\.searchParams\.get\('all'\)/)
  assert.match(ui, /allClipUsage\(\)/)
  assert.match(src('extension/sidepanel.js'), /'\/api\/cost\?all=1'/)
})

test('ตัวนับ token เดิมยังทำงาน (ไทยนับต่างกับอังกฤษ)', () => {
  assert.ok(estimateTokens('สวัสดีครับ') > 0)
  assert.ok(estimateTokens('a'.repeat(100)) < estimateTokens('ก'.repeat(100)), 'ไทยกิน token มากกว่าต่อตัวอักษร')
  assert.equal(estimateTokens(''), 0)
})

test('ปุ่มเลือกใน seg ใส่ dataset ถูกวิธี (dataset เป็น getter อย่างเดียว)', () => {
  const panel = src('extension/sidepanel.js')
  // "Cannot set property dataset of #<HTMLElement> which has only a getter" — เจอจริง 23 พ.ย. 2026
  assert.ok(!/Object\.assign\([^)]*dataset:/.test(panel), 'ห้ามใส่ dataset ผ่าน Object.assign')
  assert.match(panel, /b\.dataset\.value = o\.id/)
})
