// final review I3: แผงข้างแบบทำเอง (ส่งให้ Flow → ตั้งชื่อ + บันทึกภาพ) ใช้กติกาภาพเดียวกับ autopilot ขั้น 5
//   ตัวกรองคำรุนแรง · Style Kit (ฉากของหมวด) · inkify หลังบันทึก (ตามสวิตช์) · คำสั่ง Flow พูดถึงเฉพาะภาพที่แนบจริง
//   node --test scripts/test-manual-flow.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from '../pipeline/lib/config.mjs'
import { mergeRounds, shotlistFiles } from '../pipeline/lib/shotlist.mjs'
import { flowAttachments, flowAttachmentParts, styleKitFlowNote } from '../pipeline/lib/prompts.mjs'
import { styleKitAttachments, STYLE_KIT_DIR } from '../pipeline/lib/style-kit.mjs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const KIT_FILES = JSON.parse(readFileSync(join(STYLE_KIT_DIR, 'kit.json'), 'utf8')).files.map((f) => f.file.split(/[\\/]/).pop())

/** คลิปชั่วคราว (profile + slots + คำตอบ ChatGPT 1 รอบ) แล้วลบทิ้งหลังใช้ */
function withClip({ category = 'ghost', round }, fn) {
  const slug = `_test_manual_flow_${process.pid}_${Math.random().toString(36).slice(2, 8)}`
  const base = join(ROOT, 'projects', slug)
  try {
    mkdirSync(join(base, '00_ref'), { recursive: true })
    writeFileSync(join(base, '00_ref', 'profile.json'), JSON.stringify({ category, title: 'บ้านร้างท้ายซอย', artStyle: 'lemlabaht', inkify: true, issue: 7 }))
    mkdirSync(join(base, '01_script'), { recursive: true })
    writeFileSync(join(base, '01_script', 'title.txt'), 'บ้านร้างท้ายซอย')
    const f = shotlistFiles(slug)
    mkdirSync(f.rounds, { recursive: true })
    writeFileSync(f.slots, JSON.stringify([
      { filename: '00_00_00.png', start: 0, end: 2, narration: 'คืนนั้น' },
      { filename: '00_00_02.png', start: 2, end: 4, narration: 'เสียงเคาะ' },
    ]))
    writeFileSync(join(f.rounds, '01.txt'), round)
    return fn(slug, f)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}

const ROUND = `=== STYLE BIBLE ===
ลายเส้นการ์ตูนเล่มละบาท
=== SHOT LIST ===
00_00_00.png SHOT 01 | Chars: @main | Env: บ้านไม้ร้างกลางคืน มีซากศพนอนอยู่ เลือดสาดเต็มพื้น | Action: เดินเข้าบ้าน | Frame: wide
00_00_02.png SHOT 02 | Chars: @main | Env: ห้องโถง corpse on the floor, gore | Action: ตกใจ | Frame: close-up`

test('mergeRounds ตัดคำรุนแรงก่อนเขียน shots.json / agent_brief.txt / flowPrompt ของแผงข้าง', () => {
  withClip({ round: ROUND }, (slug, f) => {
    const merged = mergeRounds(slug)
    const banned = /ศพ|เลือดสาด|corpse|gore/i
    const shots = JSON.parse(readFileSync(f.shots, 'utf8'))
    for (const s of shots) assert.ok(!banned.test(s.prompt), `shots.json ${s.filename}: ${s.prompt}`)
    assert.ok(!banned.test(readFileSync(f.brief, 'utf8')), 'agent_brief.txt ยังมีคำรุนแรง')
    assert.ok(!banned.test(merged.agentBrief))
    // ส่วนช็อตของคำสั่ง Flow ที่แผงข้างส่ง (หัวคำสั่งมีคำห้ามในกติกาเอง เช่น "ห้ามวาด…" — ตรวจเฉพาะ SHOT LIST)
    const shotPart = merged.flowPrompt.split('=== SHOT LIST ===')[1]
    assert.ok(shotPart && !banned.test(shotPart.split('ย้ำ:')[0]), 'flowPrompt ยังมีคำรุนแรงในช็อต')
    assert.deepEqual(merged.sanitized.map((s) => s.filename), ['00_00_00.png', '00_00_02.png'])
    assert.ok(merged.sanitized[0].removed.includes('เลือดสาด'))
    // คำบรรยายส่วนอื่นยังอยู่ครบ
    assert.match(shots[0].prompt, /บ้านไม้ร้างกลางคืน/)
    assert.match(shots[1].prompt, /Frame: close-up/)
  })
})

test('flowAttachments = ตัวละครของฉัน + Style Kit ฉากของหมวด (ไม่มีปก) · ชุดเดียวกับที่ flowPrompt บอก agent', () => {
  for (const category of ['ghost', 'saiyasat', 'folk', 'drama', 'comedy']) {
    withClip({ category, round: ROUND }, (slug) => {
      const { character, kit, cast, product } = flowAttachmentParts(slug)
      assert.deepEqual(kit.map((a) => a.name), styleKitAttachments(category).map((a) => a.name), category)
      assert.ok(kit.length >= 1, `${category}: ไม่มีภาพ kit`)
      assert.ok(!kit.some((a) => a.name === 'kit-cover.jpg'), `${category}: แนบปก`)
      // แผ่นแบบจากคลังตัวละครแล้วค่อยรูปสินค้าต่อท้ายสุด — ลำดับต้องตรงกับที่ flowPrompt บอก agent
      assert.deepEqual(flowAttachments(slug).map((a) => a.name), [...character, ...kit, ...cast, ...product].map((a) => a.name))
      // คำสั่ง Flow ของแผงข้างพูดถึงภาพ kit ทุกใบที่แนบ และไม่พูดถึงภาพ kit ที่ไม่ได้แนบ
      const prompt = mergeRounds(slug).flowPrompt
      for (const a of kit) assert.ok(prompt.includes(a.name), `${category}: prompt ไม่บอก ${a.name}`)
      for (const other of KIT_FILES) {
        if (!kit.some((a) => a.name === other)) assert.ok(!prompt.includes(other), `${category}: prompt พูดถึง ${other} ที่ไม่ได้แนบ`)
      }
      assert.ok(prompt.includes(`ทั้ง ${kit.length} รูป`) || prompt.includes(`ลำดับที่ ${character.length + 1}–${character.length + kit.length}`), category)
    })
  }
})

test('styleKitFlowNote: ไม่มีภาพ kit ที่แนบจริง = ไม่มีบรรทัด (ไม่พูดถึงภาพที่ไม่ได้แนบ)', () => {
  assert.equal(styleKitFlowNote('ghost', 0, []), '')
  assert.equal(styleKitFlowNote('ghost', 2, []), '')
  assert.match(styleKitFlowNote('ghost', 1, ['a.jpg']), /ลำดับที่ 2–2 \(ท้ายสุด\) \(a\.jpg\)/)
})

test('แผงข้าง: แนบรูปชุดเดียวกับ autopilot และแปลงเป็นงานพิมพ์หลังบันทึกภาพ', () => {
  const panel = read('extension/sidepanel.js')
  const run = /type: 'FLOW_AGENT_RUN'[^\n]*/.exec(panel)[0]
  assert.match(run, /attachments \}/)
  assert.match(panel, /api\(await localApp\(\), '\/api\/flow\/attachments'\)/)
  assert.ok(!/attachments=1/.test(panel), 'ยังแนบแค่รูปตัวละคร')
  assert.match(run, /aspect: shotsData\.aspect \?\? '9:16'/)
  // บันทึกภาพครบแล้วเรียก inkify ครั้งเดียว (ก่อนสรุปสถานะ)
  // \r?\n: ไฟล์ในโครงการนี้ลงท้ายบรรทัดแบบ CRLF — regex ที่ใช้ \n เฉยๆ จะตัดไม่ได้แล้วล้มทั้งข้อ ทั้งที่โค้ดถูก
  const save = /async function saveFlowImages[\s\S]*?\r?\n\}\r?\n/.exec(panel)[0]
  assert.ok(save.indexOf("'/api/images/save'") < save.indexOf("'/api/images/inkify'"))
})

test('bridge: /api/flow/attachments ใช้ flowAttachments · /api/images/inkify ใช้ inkifyAll ตามสวิตช์ (inkifyEnabled)', () => {
  const ui = read('bridge/ui.js')
  // ตัดช่วงของแต่ละ endpoint ด้วย "ถึง endpoint ถัดไป" แทนการนับวงเล็บปิดตามการเยื้อง
  // (แบบเดิมผูกกับ `\n      }\n` พอแก้โค้ดรอบๆ ทีไรก็ตัดไม่ได้แล้วล้มทั้งข้อ ทั้งที่โค้ดยังถูก)
  const section = (route) => {
    const start = ui.indexOf(`path === '${route}'`)
    assert.ok(start > 0, `ไม่พบ endpoint ${route}`)
    const next = ui.indexOf("path === '/api/", start + route.length + 12)
    return ui.slice(start, next > 0 ? next : ui.length)
  }
  assert.match(section('/api/flow/attachments'), /flowAttachments\(slug\)/)
  const ink = section('/api/images/inkify')
  assert.match(ink, /inkifyEnabled\(loadConfig\(\), profile\)/)
  assert.match(ink, /inkifyAll\(dir, \{ categoryId: profile\?\.category/)
})

test('5_images ใช้ flowAttachments ตัวเดียวกัน · 6_render แปลงภาพที่ยังไม่แปลงก่อนตัดต่อ (ด่านเดียวของทุกที่มา)', () => {
  const images = read('pipeline/5_images.mjs')
  assert.match(images, /attachments: flowAttachments\(slug, profile\?\.category, \{ shotsText: brief \}\)/)
  // แต่ละชุดของ Flow แนบแผ่นแบบเฉพาะตัวละครในชุดนั้น — ดู test-cast-per-shot.mjs
  assert.match(images, /attachmentsFor: batchShots => flowAttachments\(slug, profile\?\.category, \{ shotsText:/)
  const render = read('pipeline/6_render.mjs')
  assert.match(render, /inkifyEnabled\(config, profile\)[\s\S]*inkifyAll\(imagesDir/)
  assert.ok(render.indexOf('inkifyAll(imagesDir') < render.indexOf('renderVideo('), 'ต้องแปลงก่อน render')
})
