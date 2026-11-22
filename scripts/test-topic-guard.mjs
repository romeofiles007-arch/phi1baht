// เทสต์: ระบบป้องกันทำ content ซ้ำ — ตัวตัดสินเรื่องซ้ำ (extension/dedupe.js) + การกระจายเรื่อง + สายไฟที่ต่อถึงแผงข้าง
//   node scripts/test-topic-guard.mjs
// บทเรียนจากแอปต้นแบบ (19 พ.ย. 2026): "ป้องกันสร้าง content ซ้ำ" — ตัวตัดสินต้องเป็นของช่องนี้เอง
// Task 4: ตัวอย่างเปลี่ยนเป็นเรื่องผีไทย · ตัวตัดสินดูจาก หมวด + ชนิดผีหรือตัวละครหลัก + พล็อตหลัก
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GUARD_WINDOW, NEAR_SAME, squash, similarity, nearSame,
  localDuplicate, dedupePrompt, parseDedupe, screenTopics,
} from '../extension/dedupe.js'
import { recentTopics } from '../pipeline/lib/topic-guard.mjs'

let passed = 0
const test = (name, fn) => {
  const done = fn()
  return Promise.resolve(done).then(() => {
    passed++
    console.log(`  ✓ ${name}`)
  })
}

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

// เรื่องที่ "ทำไปแล้ว" สำหรับทดสอบ (รูปเดียวกับที่ recentTopics คืน)
const RECENT = [
  { slug: 'a', title: 'กระสือกับหมอตำแยคืนเดือนมืด', at: 3, key: 'ผีไทย · กระสือ · หมอตำแยถูกตามกินของสด' },
  { slug: 'b', title: 'ทำไมทิดมาถึงไม่กลับจากป่าช้า', at: 2, key: 'ตลกบ้านทุ่ง · ทิดมา · ขี้โม้จนต้องนอนป่าช้า' },
  { slug: 'c', title: 'ตะกรุดดอกสุดท้ายของหมอผีเฒ่า', at: 1, key: null },
]

await test('เทียบชื่อเรื่อง: ตัดวรรคตอน · ชื่อเกือบเหมือนจับได้ · คนละเรื่องไม่โดน', () => {
  assert.equal(GUARD_WINDOW, 100)
  assert.equal(NEAR_SAME, 0.7)
  assert.equal(squash('กระสือ · หมอตำแย!'), 'กระสือหมอตำแย')
  assert.equal(similarity('นางตะเคียน', 'นางตะเคียน'), 1)
  // แก้ไม่กี่คำ = เรื่องเดียวกัน
  assert.ok(nearSame('กระสือกับหมอตำแยคืนเดือนมืด', 'กระสือกับหมอตำแยคืนเดือนมืด?'))
  // รูปประโยคเดียวกันแต่คนละเรื่อง ต้องไม่ถือว่าซ้ำ
  assert.ok(!nearSame('ทำไมทิดมาถึงไม่กลับจากป่าช้า', 'ทำไมยายเผื่อนต้องปิดหน้าต่างทุกคืน'))
  assert.ok(!nearSame('', 'อะไรก็ได้'))
})

await test('ชั้นที่ 1 ในเครื่อง: ซ้ำทั้งจากชื่อเรื่องและจากแก่นเรื่อง', () => {
  assert.equal(localDuplicate('กระสือกับหมอตำแยคืนเดือนมืด!', RECENT)?.slug, 'a')
  // ชื่อใหม่หมด แต่แก่นเรื่องเดียวกัน → ยังจับได้ (นี่คือเหตุที่ต้องเก็บ key ไว้กับคลิป)
  assert.equal(localDuplicate({ title: 'คืนที่กระสือตามกลิ่นเรือนคนคลอด', key: 'ผีไทย · กระสือ · หมอตำแยถูกตามกินของสด' }, RECENT)?.slug, 'a')
  assert.equal(localDuplicate('ปอบกับเศรษฐีขี้เหนียวท้ายตลาด', RECENT), null)
})

await test('prompt ตรวจเรื่องซ้ำเป็นของช่องผี 1 บาท ไม่เหลือคำของแอปต้นแบบ', () => {
  const p = dedupePrompt([{ title: 'คืนที่นางตะเคียนร้องไห้' }], RECENT)
  assert.match(p, /การ์ตูนเล่มละบาท "ผี 1 บาท"/)
  assert.match(p, /หมวด \+ ชนิดผีหรือตัวละครหลัก \+ พล็อตหลัก/)
  // ชื่อเรียกต่างกันของผีตัวเดียวกันคือซ้ำ · ผีชนิดเดียวกันแต่พล็อตต่างกันไม่ซ้ำ · คนละหมวดไม่ซ้ำ
  assert.match(p, /นางตะเคียน = ผีต้นตะเคียน/)
  assert.match(p, /ผีชนิดเดียวกันแต่พล็อตต่างกันชัดเจน/)
  assert.match(p, /คนละหมวด/)
  // key ที่เก็บไว้กับคลิปเป็นรูป หมวด · ตัวหลัก · พล็อต
  assert.match(p, /"หมวด · ชนิดผีหรือตัวละครหลัก · พล็อตหลัก"/)
  // เรื่องที่ทำไปแล้วและหัวข้อใหม่ต้องอยู่ใน prompt ครบ พร้อมแก่นเรื่อง
  for (const r of RECENT) assert.ok(p.includes(r.title))
  assert.ok(p.includes('แก่นเรื่อง: ตลกบ้านทุ่ง · ทิดมา · ขี้โม้จนต้องนอนป่าช้า'))
  assert.ok(p.includes('คืนที่นางตะเคียนร้องไห้'))
  assert.ok(!/ธรรมะ|ชาดก|พระสูตร|หลักธรรม|จีน|ขงเบ้ง|สามก๊ก|วรรณกรรม/.test(p))
})

await test('อ่านผลตรวจ: ผลครบ · ไม่ครบ = throw · เลขข้ออ้างผิดยังนับว่าซ้ำ', () => {
  const cands = [{ title: 'ก' }, { title: 'ข' }]
  const ok = parseDedupe('ตอบว่า [{"n":1,"dup":false,"same":null,"key":"แก่น ก","why":""},\n{"n":2,"dup":true,"same":2,"key":"แก่น ข","why":"เรื่องเดียวกัน"}] จบ', cands, RECENT)
  assert.deepEqual(ok.map((r) => r.dup), [false, true])
  assert.equal(ok[0].key, 'แก่น ก')
  assert.equal(ok[1].sameAs.slug, 'b')
  assert.throws(() => parseDedupe('[{"n":1,"dup":false}]', cands, RECENT), /ไม่มีข้อ 2/)
  assert.throws(() => parseDedupe('ไม่มี json', cands, RECENT), /อ่านผลตรวจเรื่องซ้ำ/)
  // ชี้เลขข้อนอกช่วง → ยังถือว่าซ้ำ (ตัดสินเข้มไว้ก่อน) แค่ไม่รู้ว่าซ้ำกับข้อไหน
  const loose = parseDedupe('[{"n":1,"dup":true,"same":99,"key":"x","why":"ซ้ำ"},{"n":2,"dup":false,"same":null,"key":"y","why":""}]', cands, RECENT)
  assert.equal(loose[0].dup, true)
  assert.equal(loose[0].sameAs, null)
})

await test('คัดหัวข้อ: ตัดข้อที่ซ้ำทั้งจากในเครื่องและจาก ChatGPT · ข้อที่ผ่านได้ key ติดไป', async () => {
  const candidates = [
    { title: 'กระสือกับหมอตำแยคืนเดือนมืด', score: 90 }, // ซ้ำชัดจากชื่อ → ชั้นที่ 1 ตัด
    { title: 'คืนที่กระสือตามกลิ่นเรือนคนคลอด', score: 88 },
    { title: 'ศรีธนญชัยกับยักษ์ที่หิวทั้งปี', score: 80 },
  ]
  let asked = 0
  const ask = async (prompt) => {
    asked++
    assert.ok(!prompt.includes('. กระสือกับหมอตำแยคืนเดือนมืด\n1. คืนที่'), 'ข้อที่ชั้นที่ 1 ตัดแล้วไม่ต้องส่งให้ ChatGPT ตรวจอีก')
    assert.ok(prompt.includes('รายการ B — หัวข้อใหม่ที่เสนอ:\n1. คืนที่กระสือตามกลิ่นเรือนคนคลอด\n2. ศรีธนญชัย'))
    return '[{"n":1,"dup":true,"same":1,"key":"ผีไทย · กระสือ · หมอตำแย","why":"ผีตัวเดียวกัน พล็อตเดียวกัน"},{"n":2,"dup":false,"same":null,"key":"นิทานพื้นบ้าน · ศรีธนญชัย · หลอกยักษ์ให้อดอาหาร","why":""}]'
  }
  const out = await screenTopics(candidates, RECENT, ask)
  assert.equal(asked, 1)
  assert.equal(out.judged, true)
  assert.deepEqual(out.fresh.map((t) => t.title), ['ศรีธนญชัยกับยักษ์ที่หิวทั้งปี'])
  assert.equal(out.fresh[0].key, 'นิทานพื้นบ้าน · ศรีธนญชัย · หลอกยักษ์ให้อดอาหาร')
  assert.equal(out.fresh[0].score, 80, 'คะแนนเดิมต้องไม่หาย')
  assert.deepEqual(out.rejected.map((r) => r.by), ['local', 'ai'])
})

await test('ตัวตรวจล่มไม่หยุดการผลิต: ChatGPT ตอบอ่านไม่ออก → ใช้ผลชั้นที่ 1 แล้วบอกว่าตรวจไม่สำเร็จ', async () => {
  let tries = 0
  const out = await screenTopics([{ title: 'ปอบกับเศรษฐีขี้เหนียวท้ายตลาด' }], RECENT, async () => (tries++, 'ขอโทษครับ ตอบไม่ได้'))
  assert.equal(tries, 2, 'ลองซ้ำ 2 รอบก่อนยอมแพ้')
  assert.equal(out.judged, false)
  assert.ok(out.error)
  assert.equal(out.fresh.length, 1)
})

await test('ยังไม่มีเรื่องที่ทำไปแล้ว หรือไม่มีตัวถาม → ไม่เรียก ChatGPT เปล่าๆ', async () => {
  let asked = 0
  const ask = async () => (asked++, '[]')
  assert.equal((await screenTopics([{ title: 'ก' }], [], ask)).fresh.length, 1)
  assert.equal((await screenTopics([{ title: 'ก' }], RECENT, null)).fresh.length, 1)
  assert.equal(asked, 0)
})

await test('หัวข้อที่เสนอในแผงข้างถูกตรวจซ้ำจริง (ไม่ใช่แค่ฝากไว้ใน prompt)', () => {
  const panel = read('extension/sidepanel.js')
  assert.match(panel, /import \{ screenTopics, localDuplicate \} from '\.\/dedupe\.js'/)
  assert.match(panel, /screenTopics\(offered, recent, \(prompt\) => askChatGPT\(prompt\)\)/)
  // ซ้ำทุกข้อ → ไม่เอาเข้ารายการให้เลือก แต่บอกให้กดเสนอใหม่
  assert.match(panel, /ซ้ำกับเรื่องที่ทำไปแล้ว — กด "เสนอหัวข้อใหม่" อีกครั้ง/)
  // หัวข้อที่พิมพ์เองก็ต้องถูกเตือน และแก่นเรื่องถูกส่งไปเก็บกับคลิป
  assert.match(panel, /localDuplicate\(title, history\?\.recent \?\? \[\]\)/)
  assert.match(panel, /กด ▶ อีกครั้งถ้าจะทำซ้ำจริง/)
  assert.match(panel, /minutes: S\.minutes, scare, key/)
})

await test('โปรแกรมในเครื่องส่งเรื่องที่ทำไปแล้วให้แผงข้าง และเก็บแก่นเรื่องไว้กับคลิป', () => {
  const ui = read('bridge/ui.js')
  assert.match(ui, /recentTopics\(GUARD_WINDOW\)\.map\(\(r\) => \(\{ title: r\.title, key: r\.key \}\)\)/)
  assert.match(ui, /\{ done: listDoneTitles\(\), seen: listSeenTitles\(\), recent \}/)
  assert.match(ui, /topics_scored\.json'\)\r?\n\s+if \(!existsSync\(pickFile\)\)/)
  // pipeline ยังเรียกใช้ตัวตัดสินชุดเดียวกันได้ (re-export จาก extension/dedupe.js)
  assert.equal(typeof recentTopics, 'function')
  assert.ok(Array.isArray(recentTopics(3)))
  assert.match(read('pipeline/lib/topic-guard.mjs'), /from '\.\.\/\.\.\/extension\/dedupe\.js'/)
})


// บทเรียนจากแอปต้นแบบ (19 พ.ย. 2026): "ทำไมทำแต่เรื่องเดิม" — มุมเล่าเคยฝังชื่อคนดังไว้ ChatGPT จึงเสนอคนเดิมทุกรอบ
// ผี 1 บาท: มุมเล่าต้องไม่ฝังชนิดผีหรือตัวละคร — ตัวหลักมาจาก TOPIC_SEEDS ที่ระบบสุ่มให้แต่ละข้อ
await test('มุมเล่าไม่ผูกกับผีหรือตัวละครใดตัวหนึ่ง', async () => {
  const { ANGLES, TOPIC_SEEDS } = await import('../extension/prompts.js')
  const names = Object.values(TOPIC_SEEDS).flatMap((s) => s.subjects)
  for (const w of [...names, 'นางนาก', 'แม่นาก']) assert.ok(!ANGLES.join(' ').includes(w), w)
})

await test('autopilot ใช้หัวข้อเล่าเรื่องก่อน ไม่เรียงตามบุคคล', () => {
  const src = read('pipeline/autopilot.mjs')
  assert.ok(src.includes('topics = storyTitlesFirst(screened.fresh)'))
})

console.log(`\nผ่าน ${passed} ข้อ`)
