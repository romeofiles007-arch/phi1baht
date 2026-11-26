// แผ่นแบบตัวละครแนบเฉพาะตัวที่อยู่ในช็อต (ผู้ใช้ 26 พ.ย. 2026: "แนบตัวละครที่ไม่เกี่ยวข้องลงไปด้วยในบางฉาก ทำให้ Flow สับสน")
//   · แต่ละชุดของ Flow แนบเฉพาะตัวละครที่อยู่ในช่อง Chars: ของช็อตในชุดนั้น
//   · ท้ายบรรทัดภาพบอกว่าใช้แผ่นแบบรูปไหน และเลขรูปตรงกับรูปที่แนบจริง
//   node --test scripts/test-cast-per-shot.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// คลังแผ่นแบบปลอม — ต้องตั้งก่อน import (cast.mjs อ่าน PHI_CAST_DIR ตอนโหลด)
const castDir = mkdtempSync(join(tmpdir(), 'phi-cast-'))
process.env.PHI_CAST_DIR = castDir
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000050001', 'hex')
const sheets = {}
for (const id of ['man_young', 'old_woman', 'old_man', 'woman_mid', 'headman']) {
  writeFileSync(join(castDir, `cast_${id}.png`), PNG)
  sheets[id] = { file: `cast_${id}.png`, savedAt: 1 }
}
writeFileSync(join(castDir, 'cast.json'), JSON.stringify({ sheets }))

const { ROOT } = await import('../pipeline/lib/config.mjs')
const { castPlan, flowAttachments, flowPrompt, shotCharTags } = await import('../pipeline/lib/prompts.mjs')
const { generateWithFailover } = await import('../pipeline/lib/flow-failover.mjs')

const BIBLE = `=== CHARACTER BIBLE ===
@hero = ชาญ ชายหนุ่มผู้โกงโฉนดที่ดิน [CAST:man_young]
@aunt = ป้าสาย เจ้าของที่นาผู้ถูกโกง [CAST:old_woman]
@ghost = ลุงเพิ่ม คนขับรถเมล์ผู้ล่วงลับ [CAST:old_man]
@headman = ผู้ใหญ่บ้าน [CAST:headman]
@relative = ญาติของป้าสาย [CAST:woman_mid]
@bus = รถเมล์สีเขียวคาดแดง`

const line = (n, chars) => `00_00_${String(n).padStart(2, '0')}.png | SHOT ${String(n).padStart(2, '0')} | Chars: ${chars} | Env: ทุ่งนา | Action: ยืน | Frame: wide`
const SHOTS = [
  line(1, '@hero, @bus'),
  line(2, '@hero, @aunt'),
  line(3, '@hero'),
  line(4, '@ghost, @bus'),
  line(5, '@bus'),
  line(6, '@aunt, @headman'),
  line(7, '@hero, @ghost'),
]

function withClip(fn) {
  const slug = `_test_cast_per_shot_${process.pid}_${Math.random().toString(36).slice(2, 8)}`
  const base = join(ROOT, 'projects', slug)
  try {
    mkdirSync(join(base, '00_ref'), { recursive: true })
    writeFileSync(join(base, '00_ref', 'profile.json'), JSON.stringify({ category: 'ghost', title: 'รถเมล์เที่ยวสุดท้าย', artStyle: 'lemlabaht' }))
    mkdirSync(join(base, '04_shotlist', 'rounds'), { recursive: true })
    writeFileSync(join(base, '04_shotlist', 'rounds', '01.txt'), `${BIBLE}\n=== SHOT LIST ===\n${SHOTS.join('\n')}`)
    writeFileSync(join(base, '04_shotlist', 'agent_brief.txt'), `${BIBLE}\n\n=== SHOT LIST ===\n\n${SHOTS.join('\n\n')}`)
    return fn(slug)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}

test.after(() => rmSync(castDir, { recursive: true, force: true }))

test('shotCharTags อ่านเฉพาะช่อง Chars:', () => {
  assert.deepEqual(shotCharTags(line(1, '@hero, @bus')), ['@hero', '@bus'])
  assert.deepEqual(shotCharTags('00_00_00.png | SHOT 01 | Env: @hero เดิน'), [])
})

test('ทั้งคลิป: แนบตัวที่ออกหลายช็อตก่อน ไม่แนบตัวที่ไม่อยู่ในช็อตไหนเลย', () => {
  withClip((slug) => {
    const ids = castPlan(slug).attachments.map((a) => a.castId)
    // hero 4 ช็อต · aunt 2 · ghost 2 (aunt มาก่อนใน Bible) · headman 1 หลุดเพราะเกิน 3 · relative ไม่อยู่ในช็อตไหน
    assert.deepEqual(ids, ['man_young', 'old_woman', 'old_man'])
    assert.equal(castPlan(slug).attachments[0].storyName, 'ชาญ')
  })
})

test('ชุดที่มีแต่บางตัว แนบเฉพาะตัวนั้น และคำสั่งชี้เลขรูปตรงกับที่แนบ', () => {
  withClip((slug) => {
    const batch = [SHOTS[4], SHOTS[5]].join('\n') // @bus อย่างเดียว · ป้าสาย + ผู้ใหญ่บ้าน
    const att = flowAttachments(slug, 'ghost', { shotsText: batch })
    assert.deepEqual(att.map((a) => a.castId), ['old_woman', 'headman'])
    const prompt = flowPrompt(`=== SHOT LIST ===\n${batch}`, {}, slug)
    const shot5 = prompt.split('\n').find((l) => l.startsWith('00_00_05.png'))
    const shot6 = prompt.split('\n').find((l) => l.startsWith('00_00_06.png'))
    assert.match(shot5, /\[แผ่นแบบ: ภาพนี้ไม่มีตัวละครจากแผ่นแบบรูปที่ 1–2/)
    assert.match(shot6, /\[แผ่นแบบ: รูปที่ 1 = ป้าสาย, รูปที่ 2 = ผู้ใหญ่บ้าน\]/)
    assert.ok(!/ชาญ|ลุงเพิ่ม/.test(prompt.split('=== SHOT LIST ===')[0]), 'บอก agent ถึงตัวที่ไม่ได้แนบ')
    assert.match(prompt, /รูปลำดับที่ 1 = ป้าสาย/)
  })
})

test('ช็อตที่มีตัวเดียวห้ามเอาคนจากแผ่นแบบอื่น', () => {
  withClip((slug) => {
    const prompt = flowPrompt(`=== SHOT LIST ===\n${SHOTS.join('\n')}`, {}, slug)
    const shot3 = prompt.split('\n').find((l) => l.startsWith('00_00_03.png'))
    assert.match(shot3, /\[แผ่นแบบ: รูปที่ 1 = ชาญ · ห้ามวาดตัวละครจากแผ่นแบบรูปอื่นลงในภาพนี้\]/)
    const shot7 = prompt.split('\n').find((l) => l.startsWith('00_00_07.png'))
    assert.match(shot7, /รูปที่ 1 = ชาญ, รูปที่ 3 = ลุงเพิ่ม/)
  })
})

test('คลิปรุ่นเก่าไม่มีช่อง Chars: ใช้แบบเดิม (ตาม Bible) และไม่ต่อท้ายบรรทัด', () => {
  withClip((slug) => {
    const old = '00_00_00.png SHOT 01 | ชาญยืนกลางทุ่ง'
    assert.deepEqual(castPlan(slug, old).attachments.map((a) => a.castId), ['man_young', 'old_woman', 'old_man'])
    assert.ok(!flowPrompt(`=== SHOT LIST ===\n${old}`, {}, slug).includes('[แผ่นแบบ:'))
  })
})

test('generateWithFailover ส่งรูปแนบของแต่ละชุดตาม attachmentsFor', async () => {
  const shots = Array.from({ length: 12 }, (_, i) => ({ filename: `s${i}.png`, prompt: `p${i}` }))
  const sent = []
  await generateWithFailover({
    payload: { shots, attachments: ['ALL'], projectUrl: null },
    promptFor: (b) => b.map((s) => s.filename).join(','),
    attachmentsFor: (b) => [`first:${b[0].filename}`],
    runJob: async ({ payload }) => {
      sent.push(payload.attachments)
      return { files: payload.shots.map((s) => ({ name: s.filename })), meta: { projectUrl: 'https://flow.google.com/project/x' } }
    },
  })
  assert.deepEqual(sent, [['first:s0.png'], ['first:s10.png']])
})
