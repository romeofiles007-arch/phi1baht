// Task 4: เนื้อหาผี 1 บาท — 5 หมวดเล่มละบาท · ระดับความสยอง · ประโยคปิดแบบเล่มละบาท · Blueprint V1 · ค่าตั้งต้น 1 นาทีแนวตั้ง
//   node --test scripts/test-categories.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CATEGORIES, GHOST_ANGLES, categoryOf, pickGenres, GENRES, RETIRED_GENRES,
  SCARE_LEVELS, resolveScare, scareRule, scareApplies,
  STORY_ENDING, endsWithLecture, scriptPrompt, scoredTopicsPrompt, categoryRule,
  TOPIC_SEEDS, pickThemes, parseTheme, subjectOf, ANGLES,
} from '../extension/prompts.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const BLUEPRINT = read('extension/VDO Concept.txt')

test('5 หมวดตามลำดับ ghost | saiyasat | folk | drama | comedy พร้อมชื่อ "หมวด N · …"', () => {
  assert.deepEqual(CATEGORIES.map((c) => c.id), ['ghost', 'saiyasat', 'folk', 'drama', 'comedy'])
  const names = ['ผีไทย', 'ไสยศาสตร์ & หมอผี', 'นิทานพื้นบ้าน & จักรๆ วงศ์ๆ', 'ชีวิตสอนใจ', 'ตลกบ้านทุ่ง']
  CATEGORIES.forEach((c, i) => {
    assert.equal(c.name, `หมวด ${i + 1} · ${names[i]}`)
    assert.ok(c.topics.length > 40, c.id)
    assert.ok(!/จีน|ธรรมะ/.test(c.topics + c.name), c.id)
  })
  assert.deepEqual(GENRES, CATEGORIES.map((c) => c.name))
  assert.deepEqual(RETIRED_GENRES, {})
  assert.deepEqual(GHOST_ANGLES, ['folk', 'karma', 'modern'])
})

test('ชุดสีของแต่ละหมวด 8–12 สี hex · ผี/ไสยโทนมืด · นิทาน/ดราม่า/ตลกโทนสว่าง', () => {
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0) / 255
  const mean = (c) => c.palette.reduce((a, h) => a + lum(h), 0) / c.palette.length
  for (const c of CATEGORIES) {
    assert.ok(Array.isArray(c.palette) && c.palette.length >= 8 && c.palette.length <= 12, c.id)
    for (const h of c.palette) assert.match(h, /^#[0-9a-f]{6}$/i, `${c.id} ${h}`)
    assert.equal(new Set(c.palette).size, c.palette.length, `${c.id} สีซ้ำ`)
  }
  const dark = ['ghost', 'saiyasat'].map((id) => mean(categoryOf(id)))
  const bright = ['folk', 'drama', 'comedy'].map((id) => mean(categoryOf(id)))
  assert.ok(Math.max(...dark) < Math.min(...bright), `มืด ${dark} · สว่าง ${bright}`)
})

test('categoryOf: รหัส ชื่อเต็ม ชื่อสั้น · mix/ว่าง/ไม่รู้จัก = null', () => {
  assert.equal(categoryOf('ผีไทย').id, 'ghost')
  assert.equal(categoryOf('ghost').id, 'ghost')
  assert.equal(categoryOf('หมวด 5 · ตลกบ้านทุ่ง').id, 'comedy')
  assert.equal(categoryOf('ไสยศาสตร์ & หมอผี').id, 'saiyasat')
  assert.equal(categoryOf('mix'), null)
  assert.equal(categoryOf(''), null)
  assert.equal(categoryOf('sanguo'), null)
  assert.deepEqual(new Set(pickGenres('mix', 5)), new Set(GENRES), 'คละหมวด 5 ข้อ = ครบทั้ง 5 หมวด')
  assert.deepEqual(pickGenres('ghost', 3), Array(3).fill(CATEGORIES[0].name))
})

test('ระดับความสยอง: เบา กลาง เข้ม สุ่ม · ใช้เฉพาะหมวดผีและไสยศาสตร์', () => {
  assert.deepEqual(Object.keys(SCARE_LEVELS), ['light', 'medium', 'strong', 'random'])
  assert.deepEqual(Object.values(SCARE_LEVELS).map((s) => s.label), ['เบา', 'กลาง', 'เข้ม', '🎲 สุ่ม'])
  assert.ok(['light', 'medium', 'strong'].includes(resolveScare('random', () => 0.1)))
  assert.equal(resolveScare('random', () => 0.99), 'strong')
  assert.equal(resolveScare('strong'), 'strong')
  assert.equal(resolveScare('อะไรก็ไม่รู้'), 'medium')
  assert.equal(resolveScare(undefined), 'medium')
  const strong = scareRule('strong', 'ghost')
  assert.match(strong, /ห้าม.*(ไส้|ศพ)/)
  assert.match(strong, /เปลือย/)
  assert.match(strong, /เด็ก/)
  assert.match(strong, /เลือด.*(เล็กน้อย|หยด)/)
  assert.match(scareRule('light', 'saiyasat'), /เปลือย/)
  for (const id of ['folk', 'drama', 'comedy']) assert.equal(scareRule('strong', id), '', id)
  assert.notEqual(scareRule('light', 'ghost'), scareRule('strong', 'ghost'))
  assert.deepEqual(['ghost', 'saiyasat', 'mix', 'folk', 'comedy', ''].map(scareApplies), [true, true, true, false, false, true])
})

test('ตอนจบ: ประโยคปิดสอนใจแบบเล่มละบาท 1 ประโยค · หมวดตลกปิดด้วยมุก · จบในคลิปเสมอ', () => {
  assert.match(STORY_ENDING, /1 ประโยค/)
  assert.match(STORY_ENDING, /ทำกรรมใดไว้ ย่อมได้รับผลนั้น/)
  assert.match(STORY_ENDING, /ตลกบ้านทุ่ง.*มุกปิด/)
  assert.match(STORY_ENDING, /ติดตามตอนต่อไป/)
  assert.ok(!/ห้ามถอดข้อคิด/.test(STORY_ENDING), 'เล่มละบาทปิดด้วยประโยคสอนใจได้')
})

test('endsWithLecture: ประโยคปิดบรรทัดเดียวไม่นับ · เทศนายาวหลายบรรทัดท้ายนับ', () => {
  const story = 'คืนนั้นทิดมาไม่ได้กลับบ้าน\nเสียงหัวเราะดังมาจากใต้ต้นตะเคียน'
  assert.equal(endsWithLecture(`${story}\nทำกรรมใดไว้ ย่อมได้รับผลนั้น`), false)
  assert.equal(endsWithLecture(`${story}\nเรื่องนี้สอนให้รู้ว่า ความโลภนำมาซึ่งหายนะ`), false, 'บรรทัดเดียว')
  assert.equal(endsWithLecture(`${story}\nข้อคิดจากเรื่องนี้คือ อย่าโลภ\nบทเรียนที่สองคือ อย่าลบหลู่ของเฮี้ยน\nบทเรียนสุดท้าย จงนำไปใช้ในชีวิตจริง`), true)
  assert.equal(endsWithLecture(`${story}\nThe lesson is simple.\nIt teaches us to respect the dead.`), true)
  assert.equal(endsWithLecture(''), false)
})

test('คำสั่งเขียนบท: หมวด + ระดับความสยอง + ตอนจบใหม่ · ไม่มีคำสั่งเนื้อหาจีนเหลือ', () => {
  for (const c of CATEGORIES) {
    const p = scriptPrompt(BLUEPRINT, 'คืนที่กระสือมาเคาะประตู', { language: 'th', targetMinutes: 1, profile: { category: c.id, scare: 'strong' }, engage: false })
    assert.ok(p.includes(STORY_ENDING), c.id)
    assert.ok(p.includes(c.name), c.id)
    assert.equal(p.includes(scareRule('strong', c.id)) && !!scareRule('strong', c.id), ['ghost', 'saiyasat'].includes(c.id), c.id)
    assert.ok(!/จีน|สามก๊ก|ขงเบ้ง|เพิ่มความสุข/.test(p.replace(BLUEPRINT, '')), c.id)
  }
  // ไม่ระบุความยาว = 1 นาที
  assert.match(scriptPrompt(BLUEPRINT, 'x', { profile: { category: 'ghost' } }), /ความยาวเป้าหมาย 1 นาที/)
  assert.match(scoredTopicsPrompt('BP', { genre: 'ghost' }), /ประมาณ 1 นาที/)
})

test('คำสั่งภาพของหมวดผีมีกติกาความสยอง · หมวดตลกไม่มี', () => {
  assert.match(categoryRule({ category: 'ghost', scare: 'medium' }, 'image'), /เปลือย/)
  assert.ok(!/เปลือย/.test(categoryRule({ category: 'comedy', scare: 'strong' }, 'image')))
})

test('หัวข้อสุ่ม: ตัวหลัก + ปมเรื่องตามหมวดของแต่ละข้อ · ไม่ซ้ำกันในชุด · เลี่ยงของคลิปล่าสุด', () => {
  assert.deepEqual(Object.keys(TOPIC_SEEDS), CATEGORIES.map((c) => c.id))
  for (const [id, s] of Object.entries(TOPIC_SEEDS)) {
    assert.ok(s.subjects.length >= 8 && s.cores.length >= 6, id)
    assert.ok(!/จีน|ธรรมะ/.test(JSON.stringify(s)), id)
  }
  assert.ok(TOPIC_SEEDS.ghost.subjects.includes('กระสือ'))
  const genres = ['ghost', 'ghost', 'ghost', 'comedy', 'folk'].map((id) => categoryOf(id).name)
  const themes = pickThemes(genres, [{ subject: 'กระสือ', core: null }])
  assert.equal(themes.length, 5)
  themes.forEach((t, i) => {
    const id = categoryOf(genres[i]).id
    assert.ok(TOPIC_SEEDS[id].subjects.includes(t.subject), `${id} ${t.subject}`)
    assert.ok(TOPIC_SEEDS[id].cores.includes(t.core), `${id} ${t.core}`)
  })
  assert.equal(new Set(themes.map((t) => t.subject)).size, 5)
  assert.ok(!themes.some((t) => t.subject === 'กระสือ'), 'เพิ่งทำกระสือไป')
  // หัวข้อผีได้มุมต่างกัน (ผีพื้นบ้าน / กรรมตามสนอง / ร่วมสมัย)
  assert.deepEqual(new Set(themes.slice(0, 3).map((t) => t.angle)), new Set(GHOST_ANGLES))
  assert.equal(themes[3].angle, undefined)
  assert.deepEqual(parseTheme('ปอบ / ลบหลู่ศาลเจ้าที่'), { subject: 'ปอบ', core: 'ลบหลู่ศาลเจ้าที่' })
  assert.equal(subjectOf('คืนที่นางตะเคียนร้องไห้'), 'นางตะเคียน')
  assert.equal(subjectOf('อะไรก็ไม่รู้'), null)
  const p = scoredTopicsPrompt('BP', { genre: 'mix', themes })
  for (const t of themes) assert.ok(p.includes(t.subject) && p.includes(t.core), t.subject)
  for (const a of ANGLES) assert.ok(!/สอน|ข้อคิด|บทเรียน|วิธี|จีน/.test(a), a)
})

test('(Review Focus 4) ความยาวตั้งต้น 1 นาทีตรงกันทุกที่ · แนวตั้ง 9:16', () => {
  const config = JSON.parse(read('config/default.config.json'))
  assert.equal(config.script.targetMinutes, 1)
  assert.equal(config.render.orientation, 'portrait')
  assert.equal(config.script.scare, 'medium')
  assert.equal('mood' in config.script, false)
  assert.equal(config.images.aspectRatio, '9:16')
  const html = read('extension/sidepanel.html')
  assert.match(html, /id="autoMinutes"[^>]*value="1"/)
  assert.match(html, /id="minutes"[^>]*value="1"/)
  assert.match(read('extension/sidepanel.js'), /minutes: 1,/)
  const auto = read('pipeline/autopilot.mjs')
  assert.match(auto, /\[--minutes 1\]/)
  assert.ok(!/--minutes 5/.test(auto))
})

test('Blueprint V1 ผี 1 บาท: คงโครง STAGE/OUTPUT/@TAG/ชื่อไฟล์=timecode · ไม่มีเนื้อหาจีน', () => {
  for (const h of ['V1 ผี 1 บาท', 'STAGE 1', 'STAGE 2', 'OUTPUT 2', 'OUTPUT 5', '5.1', '5.2', '5.3', 'OUTPUT 4', '### OUTPUT 4 —', '## 4. สูตร Hook', '@TAG', 'HH_MM_SS.png', '00_00_02_5.png', '=== VISUAL STYLE DNA ===', '=== CHARACTER BIBLE ===', 'AGENT BRIEF']) {
    assert.ok(BLUEPRINT.includes(h), h)
  }
  assert.ok(!/จีน/.test(BLUEPRINT))
  assert.ok(!/ธรรมะ|สามก๊ก|ขงเบ้ง|2D doodle|SIMPLE MODE/i.test(BLUEPRINT))
  for (const c of CATEGORIES) assert.ok(BLUEPRINT.includes(c.name), c.name)
  // โครงเรื่อง 1 นาที + กติกาเรื่องแต่งและความรุนแรง
  for (const re of [/0–5 วิ/, /20–25 ภาพ/, /ทำกรรมใดไว้ ย่อมได้รับผลนั้น/, /ติดตามตอนต่อไป/, /เปลือย/, /ไส้/, /เด็ก.*เหยื่อ|เหยื่อ.*เด็ก/, /กระสือ.*หัวลอย/, /บุคคลจริง/, /ลบหลู่ศาสนา/, /ลิขสิทธิ์/, /9:16/]) {
    assert.match(BLUEPRINT, re)
  }
  // shot ตัวอย่างขึ้นต้นด้วยชื่อไฟล์ = timecode และใช้ @TAG
  assert.match(BLUEPRINT, /^00_00_00\.png SHOT 01 \| Chars: @\w+/m)
  // ผู้ใช้: เล่าเป็นการ์ตูนเต็มเฟรมตรงๆ ไม่ใช่ช่องการ์ตูนบนหน้ากระดาษ — ไม่สั่งกรอบช่อง ตารางช่อง เลขหน้า
  assert.ok(!/ช่องการ์ตูน|ทีละช่อง|comic panel|panel grid of|page number[^s]/i.test(BLUEPRINT))
  assert.match(BLUEPRINT, /full-frame cartoon scene/)
  assert.match(BLUEPRINT, /no panel borders, no panel grids, no page layout, no page numbers, no gutters/)
  for (const c of CATEGORIES) {
    const p = scriptPrompt(BLUEPRINT, 'x', { profile: { category: c.id } }).replace(BLUEPRINT, '') + categoryRule({ category: c.id, scare: 'strong' }, 'image')
    assert.ok(!/ช่องการ์ตูน|กรอบช่อง|เลขหน้า|panel/i.test(p), c.id)
  }
})

test('ตัวตัดสินเรื่องซ้ำดูจาก หมวด + ชนิดผีหรือตัวละครหลัก + พล็อตหลัก', async () => {
  const { dedupePrompt } = await import('../extension/dedupe.js')
  const p = dedupePrompt([{ title: 'คืนที่กระสือมาเคาะประตูเรือนแม่หม้าย' }], [{ title: 'กระสือกับหมอตำแย', key: 'ผีไทย · กระสือ · หมอตำแยถูกตามกินของสด' }])
  assert.match(p, /หมวด \+ ชนิดผีหรือตัวละครหลัก \+ พล็อตหลัก/)
  assert.match(p, /เล่มละบาท/)
  assert.ok(p.includes('ผีไทย · กระสือ · หมอตำแยถูกตามกินของสด'))
  assert.ok(!/จีน|ขงเบ้ง|สามก๊ก|ธรรมะ/.test(p))
})

test('ธีมหมวด 5 ธีม + คละหมวด · ใช้ไฟล์ภาพที่มีอยู่จริง', async () => {
  const { existsSync } = await import('node:fs')
  const { CATEGORY_THEMES, themeForGenre } = await import('../extension/category-themes.js')
  assert.deepEqual(Object.keys(CATEGORY_THEMES), CATEGORIES.map((c) => c.id))
  for (const t of Object.values(CATEGORY_THEMES)) for (const f of [t.day, t.night, t.icon]) assert.ok(existsSync(new URL(`../extension/${f}`, import.meta.url)), f)
  assert.equal(themeForGenre('mix'), CATEGORY_THEMES.ghost)
})

test('ตัวละครของฉันใช้ได้ทุกหมวด (ไม่มีกฎบุคคลจริงเหลือ)', () => {
  const src = read('pipeline/lib/character.mjs')
  assert.ok(!/sanguo|'sage'|category === /.test(src))
  assert.ok(!/\bbasename\b/.test(src))
})
