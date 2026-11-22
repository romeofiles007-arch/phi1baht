// เทสต์: ระบบป้องกันทำ content ซ้ำ — ตัวตัดสินเรื่องซ้ำ (extension/dedupe.js) + การกระจายเรื่อง + สายไฟที่ต่อถึงแผงข้าง
//   node scripts/test-topic-guard.mjs
// ผู้ใช้ (19 พ.ย. 2026): "ป้องกันสร้าง content ซ้ำ" — ของเดิมมีแต่ใน autopilot และ prompt ตรวจซ้ำยังเป็นของช่องธรรมะ
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GUARD_WINDOW, NEAR_SAME, squash, similarity, nearSame,
  localDuplicate, dedupePrompt, parseDedupe, screenTopics,
} from '../extension/dedupe.js'
import { spreadRule, CLASSIC_WORKS } from '../extension/prompts.js'
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
  { slug: 'a', title: 'ขงเบ้งยืมลูกธนูหนึ่งแสนดอกได้อย่างไร', at: 3, key: 'สามก๊ก เรือฟางยืมลูกธนู · ใช้สถานการณ์เป็นอาวุธ' },
  { slug: 'b', title: 'ทำไมเห้งเจียต้องถูกขังใต้ภูเขา 500 ปี', at: 2, key: 'ไซอิ๋ว เห้งเจียถูกขังใต้ภูเขา · ความถือตัว' },
  { slug: 'c', title: 'บู๊สงปราบเสือด้วยอะไร', at: 1, key: null },
]

await test('เทียบชื่อเรื่อง: ตัดวรรคตอน · ชื่อเกือบเหมือนจับได้ · คนละเรื่องไม่โดน', () => {
  assert.equal(GUARD_WINDOW, 100)
  assert.equal(NEAR_SAME, 0.7)
  assert.equal(squash('ขงเบ้ง · ยืมลูกธนู!'), 'ขงเบ้งยืมลูกธนู')
  assert.equal(similarity('กวนอู', 'กวนอู'), 1)
  // แก้ไม่กี่คำ = เรื่องเดียวกัน
  assert.ok(nearSame('ขงเบ้งยืมลูกธนูหนึ่งแสนดอกได้อย่างไร', 'ขงเบ้งยืมลูกธนูหนึ่งแสนดอกได้อย่างไร?'))
  // รูปประโยคเดียวกันแต่คนละเรื่อง ต้องไม่ถือว่าซ้ำ
  assert.ok(!nearSame('ทำไมเห้งเจียต้องถูกขังใต้ภูเขา 500 ปี', 'ทำไมกวนอูต้องปล่อยโจโฉไป'))
  assert.ok(!nearSame('', 'อะไรก็ได้'))
})

await test('ชั้นที่ 1 ในเครื่อง: ซ้ำทั้งจากชื่อเรื่องและจากแก่นเรื่อง', () => {
  assert.equal(localDuplicate('ขงเบ้งยืมลูกธนูหนึ่งแสนดอกได้อย่างไร?', RECENT)?.slug, 'a')
  // ชื่อใหม่หมด แต่แก่นเรื่องเดียวกัน → ยังจับได้ (นี่คือเหตุที่ต้องเก็บ key ไว้กับคลิป)
  assert.equal(localDuplicate({ title: 'กลยุทธ์เรือฟางในคืนหมอกหนา', key: 'สามก๊ก เรือฟางยืมลูกธนู · ใช้สถานการณ์เป็นอาวุธ' }, RECENT)?.slug, 'a')
  assert.equal(localDuplicate('เปาบุ้นจิ้นตัดสินคดีขุนนางใหญ่อย่างไร', RECENT), null)
})

await test('prompt ตรวจเรื่องซ้ำเป็นของช่องจีน ไม่เหลือคำของช่องธรรมะ', () => {
  const p = dedupePrompt([{ title: 'กลเมืองร้างของขงเบ้ง' }], RECENT)
  assert.match(p, /ช่องคลิปเล่าเรื่องจีนโบราณ/)
  assert.match(p, /วรรณกรรมจีนคลาสสิก/)
  // ต้องบอกให้รู้ว่าชื่อต่างสำเนียงคือคนเดียวกัน และนิยาย/สารคดีของเหตุการณ์เดียวกันคือซ้ำ
  assert.match(p, /ขงเบ้ง = จูกัดเหลียง/)
  assert.match(p, /เห้งเจีย = ซุนหงอคง/)
  assert.match(p, /เล่าแบบวรรณกรรมกับเล่าแบบสารคดี.*เหตุการณ์เดียวกัน.*ซ้ำ/)
  // เรื่องที่ทำไปแล้วและหัวข้อใหม่ต้องอยู่ใน prompt ครบ พร้อมแก่นเรื่อง
  for (const r of RECENT) assert.ok(p.includes(r.title))
  assert.ok(p.includes('แก่นเรื่อง: ไซอิ๋ว เห้งเจียถูกขังใต้ภูเขา · ความถือตัว'))
  assert.ok(p.includes('กลเมืองร้างของขงเบ้ง'))
  // คำของช่องธรรมะเดิมต้องไม่เหลือ (ของเก่าเขียนว่า "บรรณาธิการช่องคลิปธรรมะ" + ตัวอย่างยักษ์อาฬวกะ)
  assert.ok(!/ธรรมะ|ชาดก|พระสูตร|อาฬวก|ลูกศรดอกที่สอง|หลักธรรม/.test(p))
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
    { title: 'ขงเบ้งยืมลูกธนูหนึ่งแสนดอกได้อย่างไร', score: 90 }, // ซ้ำชัดจากชื่อ → ชั้นที่ 1 ตัด
    { title: 'กลเมืองร้าง: ขงเบ้งเปิดประตูเมืองรับทัพสุมาอี้', score: 88 },
    { title: 'เกียงจูแหยตกเบ็ดไม่ใส่เหยื่อเพื่ออะไร', score: 80 },
  ]
  let asked = 0
  const ask = async (prompt) => {
    asked++
    assert.ok(!prompt.includes('ขงเบ้งยืมลูกธนูหนึ่งแสนดอกได้อย่างไร\n'), 'ข้อที่ชั้นที่ 1 ตัดแล้วไม่ต้องส่งให้ ChatGPT ตรวจอีก')
    return '[{"n":1,"dup":true,"same":1,"key":"สามก๊ก กลเมืองร้าง","why":"เล่าตอนเดียวกัน"},{"n":2,"dup":false,"same":null,"key":"ห้องสิน เกียงจูแหยตกเบ็ด · รู้จังหวะรอ","why":""}]'
  }
  const out = await screenTopics(candidates, RECENT, ask)
  assert.equal(asked, 1)
  assert.equal(out.judged, true)
  assert.deepEqual(out.fresh.map((t) => t.title), ['เกียงจูแหยตกเบ็ดไม่ใส่เหยื่อเพื่ออะไร'])
  assert.equal(out.fresh[0].key, 'ห้องสิน เกียงจูแหยตกเบ็ด · รู้จังหวะรอ')
  assert.equal(out.fresh[0].score, 80, 'คะแนนเดิมต้องไม่หาย')
  assert.deepEqual(out.rejected.map((r) => r.by), ['local', 'ai'])
})

await test('ตัวตรวจล่มไม่หยุดการผลิต: ChatGPT ตอบอ่านไม่ออก → ใช้ผลชั้นที่ 1 แล้วบอกว่าตรวจไม่สำเร็จ', async () => {
  let tries = 0
  const out = await screenTopics([{ title: 'เปาบุ้นจิ้นกับคดีที่ไม่เกรงอำนาจ' }], RECENT, async () => (tries++, 'ขอโทษครับ ตอบไม่ได้'))
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

await test('กระจายเรื่อง: บอกเรื่อง/บุคคลที่ทำไปเยอะแล้ว และเรื่องที่ยังไม่เคยทำ', () => {
  const titles = [
    'ขงเบ้งยืมลูกธนูหนึ่งแสนดอกได้อย่างไร',
    'กลเมืองร้างของขงเบ้ง',
    'ทำไมกวนอูปล่อยโจโฉไป',
    'สุมาอี้รอ 10 ปีเพื่ออะไร',
    'ทำไมเห้งเจียต้องถูกขังใต้ภูเขา 500 ปี',
  ]
  const rule = spreadRule(titles)
  assert.match(rule, /กระจายเรื่องให้ทั่ว/)
  assert.match(rule, /สามก๊ก 4 คลิป/)
  assert.match(rule, /ขงเบ้ง \(จูกัดเหลียง\) \(2 คลิป\)/) // บุคคลที่ทำไปซ้ำแล้ว ห้ามใช้อีกในรอบนี้
  assert.ok(rule.includes('ยังไม่เคยทำเลย'))
  for (const w of ['ซ้องกั๋ง', 'ห้องสิน', 'เปาบุ้นจิ้น', 'ชอหานสงคราม']) assert.ok(rule.includes(w), w)
  assert.ok(!/- ทำไปเยอะแล้ว:.*ไซอิ๋ว/.test(rule), 'เรื่องที่ทำไปคลิปเดียวยังไม่นับว่าเยอะ')
  // จับวรรณกรรมที่มาไม่ได้เลย → เหลือแค่กฎบุคคลที่เพิ่งทำ
  // ประวัติยังน้อย (ไม่ถึง 4 คลิป) → ยังไม่นับว่าเรื่องไหนเยอะ แต่บุคคลที่เพิ่งทำห้ามใช้ซ้ำทันที
  const few = spreadRule(titles.slice(0, 3))
  assert.ok(!few.includes('ทำไปเยอะแล้ว') && /เพิ่งทำไป.*ขงเบ้ง.*กวนอู/.test(few), few)
  assert.equal(spreadRule(['เล่าจื๊อสอนอะไรเรื่องถอยหนึ่งก้าว', 'นิทานจีนนกกระเรียนกับชาวนา', 'สุภาษิตจีนที่ใช้ได้จริง', 'ปรัชญาขันทีในวัง']).trim(), '**กระจายเรื่อง:** บุคคลที่เพิ่งทำไป ห้ามใช้ในรอบนี้: เล่าจื๊อ — เลือกคนอื่นหรือเรื่องอื่นแทน')
  assert.equal(CLASSIC_WORKS.length, 10)
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
  assert.match(panel, /minutes: S\.minutes, mood, key/)
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


// ผู้ใช้ (19 พ.ย. 2026): "ทำไมทำแต่เรื่องเดิม" — prompt เสนอหัวข้อเคยฝังชื่อขงเบ้ง/ซุนวู/เล่าจื๊อไว้ในมุมเล่าและหลักคิดแกน
// ChatGPT จึงเสนอคนเดิมทุกรอบ แล้วระบบเลือกข้อคะแนนสูงสุด (คนดังสุด = ขงเบ้ง) ทุกครั้ง
await test('มุมเล่าและหลักคิดแกนไม่ผูกกับบุคคลหรือเรื่องใดเรื่องหนึ่ง', async () => {
  const { ANGLES, WISDOM_POINTS, FIGURES } = await import('../extension/prompts.js')
  const names = FIGURES.flatMap((f) => [f.name, ...f.aka]).filter((n) => n.length >= 3)
  for (const line of [...ANGLES, ...WISDOM_POINTS]) {
    const hit = names.find((n) => line.includes(n))
    assert.ok(!hit, `"${line}" ผูกกับ ${hit}`)
  }
  for (const w of ['สามก๊ก', 'ขงเบ้ง', 'บุญ', 'นรก', 'บาป', 'หลักธรรม']) {
    assert.ok(!ANGLES.join(' ').includes(w) && !WISDOM_POINTS.join(' ').includes(w), w)
  }
})

await test('เลือกหัวข้อ: คะแนนสูงแต่เป็นคน/เรื่องที่เพิ่งทำ → หลีกให้เรื่องใหม่', async () => {
  const { pickVaried } = await import('../extension/prompts.js')
  const offered = [
    { title: 'ขงเบ้งจะทำอย่างไรถ้าต้องเริ่มใหม่', score: 92 },
    { title: 'บู๊สงปราบเสือด้วยอะไร', score: 80 },
    { title: 'นิทานจีนชายชราเสียม้า', score: 78 },
  ]
  const recent = ['ขงเบ้งทิ้งกลยุทธ์อะไรไว้ให้คนรุ่นหลัง']
  assert.equal(pickVaried(offered, recent)[0].title, 'บู๊สงปราบเสือด้วยอะไร')
  assert.equal(pickVaried(offered, recent).length, 3, 'ไม่ทิ้งข้อไหน แค่เรียงใหม่')
  // ไม่มีประวัติ → เรียงตามคะแนนเดิม
  assert.equal(pickVaried(offered, [])[0].title, offered[0].title)
  // เรื่องเดียวกัน (สามก๊ก) แต่คนละคน → หักน้อยกว่าคนเดิม
  const sameWork = [{ title: 'กวนอูกับคำสัญญา', score: 85 }, { title: 'ขงเบ้งกับพัดขนนก', score: 90 }]
  assert.equal(pickVaried(sameWork, recent)[0].title, 'กวนอูกับคำสัญญา')
})

await test('กระจายเรื่องตั้งแต่คลิปแรก: บุคคลที่เพิ่งทำห้ามใช้ในรอบถัดไป', () => {
  const rule = spreadRule(['ขงเบ้งทิ้งกลยุทธ์อะไรไว้ให้คนรุ่นหลัง'])
  assert.match(rule, /เพิ่งทำไป.*ขงเบ้ง/)
  assert.ok(!rule.includes('ทำไปเยอะแล้ว'))
})

await test('autopilot เลือกหัวข้อแบบกระจายเรื่อง ไม่ใช่คะแนนสูงสุดตรงๆ', () => {
  const src = read('pipeline/autopilot.mjs')
  assert.match(src, /pickVaried\(storyTitlesFirst\(screened\.fresh\), recent\.map\(\(r\) => r\.title\)\)/)
})

console.log(`\nผ่าน ${passed} ข้อ`)
