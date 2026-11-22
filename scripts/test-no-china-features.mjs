// Task 3: ฟีเจอร์เฉพาะของ China ต้องไม่เหลือในผี 1 บาท (ผู้เล่าเรื่องเอง · บุคคลจริง/วิกิพีเดีย · โหมดประวัติศาสตร์ · ภาษาจีน)
//   node --test scripts/test-no-china-features.mjs
// ชื่อที่ต้องหายไปแยกเป็นชิ้นเพื่อไม่ให้ grep ตรวจความสะอาดของโค้ดเจอตัวเทสต์เอง
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import * as P from '../extension/prompts.js'

const at = (p) => new URL(`../${p}`, import.meta.url)
const read = (p) => readFileSync(at(p), 'utf8')

test('prompts.js ไม่มี export ของฟีเจอร์จีน', () => {
  const gone = ['FIGU' + 'RES', 'CLASSIC_' + 'WORKS', 'NARRA' + 'TIONS', 'figure' + 'InTitle', 'figures' + 'Of', 'selfNarrator' + 'Name', 'HAN_CHARS_' + 'PER_WORD', 'STORY_' + 'ANGLES', 'spread' + 'Rule', 'pick' + 'Varied']
  for (const k of gone) assert.equal(k in P, false, `ต้องไม่มี export ${k}`)
})

test('ภาษามีแค่ th กับ en', () => {
  assert.deepEqual(Object.keys(P.LANG_LABEL), ['th', 'en'])
  assert.throws(() => P.scriptPrompt('BP', 'x', { language: 'z' + 'h' }))
  assert.match(P.lengthTarget('th', 1), /ตัวอักษรไทย/)
})

test('ไม่มีหมวดผู้เล่าเรื่อง (id self) และไม่มีหมวดโหมดเฉพาะ', () => {
  assert.equal(P.CATEGORIES.some((c) => c.id === 'self'), false)
  assert.equal(P.CATEGORIES.some((c) => c.exclusive), false)
  assert.deepEqual(P.CATEGORIES.map((c) => c.id), ['sanguo', 'sage', 'tale']) // Task 4 จะแทนด้วย 5 หมวดผี
})

test('prompt บทไม่เหลือสไตล์ประวัติศาสตร์/พากย์จีน', () => {
  const p = P.scriptPrompt('BP', 'ชื่อเรื่อง', { language: 'th', profile: { category: 'sanguo' } })
  assert.ok(!/ย้อนรอยประวัติศาสตร์|พากย์จีน|ผู้เล่าเรื่องเจ้าของช่อง/.test(p))
})

test('sidepanel.html ไม่มีตัวเลือกภาษาจีน / วิธีเล่า / ผู้เล่าเรื่อง', () => {
  const html = read('extension/sidepanel.html')
  assert.doesNotMatch(html, /ภาษาจีน|วิธีเล่า|ผู้เล่าเรื่อง|พากย์จีน|ชื่อจีน/)
  assert.ok(!html.includes('data-value="' + 'z' + 'h"'))
  for (const id of ['selfHostBox', 'myBuddhaBox', 'clipNarration', 'prodRandNarration']) assert.ok(!html.includes(id), id)
})

test('ไฟล์ผู้เล่าเรื่อง/พระของฉัน/บุคคลจริงถูกลบ', () => {
  for (const f of ['self_' + 'narrator', 'self_monk', 'my_buddha']) assert.equal(existsSync(at(`pipeline/lib/${f}.mjs`)), false, f)
  assert.equal(existsSync(at('scripts/test-self-host.mjs')), false)
})

test('โค้ดฝั่ง bridge/pipeline ไม่เหลือเส้นทางของฟีเจอร์ที่ตัด', () => {
  const ui = read('bridge/ui.js')
  assert.doesNotMatch(ui, /api\/self-|api\/my-buddha/)
  const prod = read('bridge/production.js')
  assert.doesNotMatch(prod, /CLIP_NARRATION|random\.narration/)
  const clip = read('pipeline/lib/clip_profile.mjs')
  assert.doesNotMatch(clip, /wikipedia|wikiQuery|fetchFigure/i)
})
