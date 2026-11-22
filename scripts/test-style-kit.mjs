// เทสต์: Style Kit — ภาพอ้างอิงลายเส้นของเราเอง แนบเป็น ingredient ให้ Flow ทุกช็อต (spec 5.4 ชั้น 1)
//   node --test scripts/test-style-kit.mjs
// kit.json = { files: [{ file, categories: [...], kind: 'scene'|'cover'|'palette' }] } ใน extension/style-kit/
// kit ว่าง/ไฟล์หาย = [] ไม่ throw (ภาพจริงทำทีหลังใน Task 10) · ห้ามอ้างภาพลิขสิทธิ์ใต้ references/
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { styleKitAttachments, styleKitFiles, STYLE_KIT_DIR } from '../pipeline/lib/style-kit.mjs'
import { styleKitFlowNote } from '../pipeline/lib/prompts.mjs'
import { characterFlowNote } from '../pipeline/lib/character.mjs'
import { shipsToCustomer } from '../bridge/package-rules.js'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { paperGains, thumbRgb, isPaper } from '../pipeline/lib/inkify.mjs'

const PNG = Buffer.from('89504e470d0a1a0a', 'hex') // หัวไฟล์ PNG พอให้มีเนื้อไฟล์

function tempKit(files, entries) {
  const dir = mkdtempSync(join(tmpdir(), 'phi-style-kit-'))
  for (const name of files) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), PNG)
  }
  writeFileSync(join(dir, 'kit.json'), JSON.stringify({ files: entries }))
  return dir
}

test('kit.json ชี้ไฟล์ที่ไม่มี → [] · ไม่มี kit.json / JSON เสีย → [] ไม่ throw', () => {
  const dir = tempKit([], [{ file: 'missing.png', categories: ['ghost'], kind: 'scene' }])
  try {
    assert.deepEqual(styleKitAttachments('ghost', { dir }), [])
    writeFileSync(join(dir, 'kit.json'), '{ not json')
    assert.deepEqual(styleKitAttachments('ghost', { dir }), [])
    rmSync(join(dir, 'kit.json'))
    assert.deepEqual(styleKitAttachments('ghost', { dir }), [])
    assert.deepEqual(styleKitAttachments('ghost', { dir: join(dir, 'no-such-dir') }), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('kit 3 ไฟล์ (ghost scene, comedy scene, cover) → ghost ได้ไม่เกิน 2 ไฟล์ ของหมวด ghost ก่อน', () => {
  const dir = tempKit(
    ['ghost_scene.png', 'comedy_scene.jpg', 'cover.png'],
    [
      { file: 'comedy_scene.jpg', categories: ['comedy'], kind: 'scene' },
      { file: 'cover.png', categories: ['ghost', 'saiyasat', 'folk', 'drama', 'comedy'], kind: 'cover' },
      { file: 'ghost_scene.png', categories: ['ghost'], kind: 'scene' },
    ],
  )
  try {
    const ghost = styleKitAttachments('ghost', { dir })
    assert.ok(ghost.length >= 1 && ghost.length <= 2, JSON.stringify(ghost.map((a) => a.name)))
    assert.equal(ghost[0].name, 'ghost_scene.png') // ภาพฉากของหมวดนี้มาก่อน
    assert.ok(!ghost.some((a) => a.name === 'comedy_scene.jpg' || a.name === 'cover.png'))
    assert.deepEqual(Object.keys(ghost[0]).sort(), ['base64', 'name', 'type'])
    assert.equal(ghost[0].type, 'image/png')
    assert.equal(Buffer.from(ghost[0].base64, 'base64').toString('hex'), PNG.toString('hex'))

    const comedy = styleKitAttachments('comedy', { dir })
    assert.equal(comedy[0].name, 'comedy_scene.jpg')
    assert.equal(comedy[0].type, 'image/jpeg')
    assert.equal(styleKitAttachments('ghost', { dir, max: 1 }).length, 1)
    // ปกไม่แนบให้ช็อตเลย · หมวดที่ไม่มีฉากของตัวเอง → ใช้ฉากหมวดอื่นแทน (ไม่ใช่ปก)
    assert.deepEqual(styleKitAttachments('folk', { dir }).map((a) => a.name), ['comedy_scene.jpg', 'ghost_scene.png'])
    assert.deepEqual(styleKitFiles('ghost', { dir }).map((f) => f.file), ['ghost_scene.png'])
    assert.deepEqual(styleKitFiles('ghost', { dir, kinds: ['cover'] }).map((f) => f.file), ['cover.png'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ไฟล์นอกโฟลเดอร์ kit (เช่น ../references/) ไม่ถูกแนบ แม้ kit.json อ้างไว้', () => {
  const root = mkdtempSync(join(tmpdir(), 'phi-style-kit-root-'))
  try {
    mkdirSync(join(root, 'references', 'onebaht'), { recursive: true })
    writeFileSync(join(root, 'references', 'onebaht', 'real.png'), PNG)
    mkdirSync(join(root, 'kit'))
    writeFileSync(join(root, 'kit', 'kit.json'), JSON.stringify({ files: [
      { file: '../references/onebaht/real.png', categories: ['ghost'], kind: 'scene' },
      { file: 'references/onebaht/real.png', categories: ['ghost'], kind: 'scene' },
    ] }))
    assert.deepEqual(styleKitAttachments('ghost', { dir: join(root, 'kit') }), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('kit.json จริงอยู่ใน extension/style-kit/ ใช้ได้ (ว่างได้) และไม่อ้างไฟล์ใต้ references/', () => {
  assert.equal(STYLE_KIT_DIR.replace(/\\/g, '/').endsWith('extension/style-kit'), true)
  const kitFile = join(STYLE_KIT_DIR, 'kit.json')
  assert.ok(existsSync(kitFile))
  const kit = JSON.parse(readFileSync(kitFile, 'utf8'))
  assert.ok(Array.isArray(kit.files))
  for (const f of kit.files) {
    assert.ok(!/references|onebaht|\.\./i.test(f.file), f.file)
    assert.ok(['scene', 'cover', 'palette'].includes(f.kind), f.file)
    assert.ok(Array.isArray(f.categories), f.file)
  }
  for (const id of ['ghost', 'saiyasat', 'folk', 'drama', 'comedy', undefined]) {
    const list = styleKitAttachments(id)
    assert.ok(Array.isArray(list) && list.length <= 2, String(id))
  }
})

test('5_images.mjs แนบ Style Kit ของหมวดคลิปต่อท้ายรูปตัวละคร', () => {
  const src = readFileSync(new URL('../pipeline/5_images.mjs', import.meta.url), 'utf8')
  assert.match(src, /import \{ styleKitAttachments \} from '\.\/lib\/style-kit\.mjs'/)
  assert.match(src, /attachments: \[\.\.\.characterAttachments\(activeCharacter\(slug\)\), \.\.\.styleKitAttachments\(profile\?\.category\)\]/)
})

test('kit.json จริง: ไฟล์ครบ < 400 KB ไม่อ้าง references/ · ghost ได้ฉาก ≤2 ไม่มีปก · ทุกหมวดได้ฉาก ≥1', () => {
  const kit = JSON.parse(readFileSync(join(STYLE_KIT_DIR, 'kit.json'), 'utf8'))
  assert.equal(kit.files.length, 6)
  for (const f of kit.files) {
    const p = join(STYLE_KIT_DIR, f.file)
    assert.ok(existsSync(p), f.file)
    assert.ok(statSync(p).size < 400 * 1024, `${f.file} ${statSync(p).size}`)
    assert.ok(!/references/i.test(JSON.stringify(f)) || /ไม่ได้ส่งไปกับแอป/.test(f.source), f.file)
    assert.ok(!/references[\/]/i.test(f.file))
    assert.ok(f.source && f.categories.length, f.file)
  }
  assert.equal(kit.files.filter((f) => f.kind === 'cover').length, 1)
  const ghost = styleKitAttachments('ghost')
  assert.ok(ghost.length >= 1 && ghost.length <= 2)
  assert.equal(ghost[0].name, 'kit-ghost-house.jpg')
  for (const id of ['ghost', 'saiyasat', 'folk', 'drama', 'comedy', undefined]) {
    const files = styleKitFiles(id)
    assert.ok(files.length >= 1 && files.length <= 2, String(id))
    assert.ok(files.every((f) => f.kind === 'scene'), String(id))
    assert.ok(!styleKitAttachments(id).some((a) => a.name === 'kit-cover.jpg'), String(id))
  }
  assert.ok(existsSync(join(STYLE_KIT_DIR, 'PROVENANCE.md')))
})

test('ข้อความแนบแยก "ตัวละครหลัก" ออกจาก "ภาพอ้างอิงลายเส้น" ชัดเจน', () => {
  const kitNote = styleKitFlowNote('ghost', 2)
  assert.match(kitNote, /ลำดับที่ 3–4/)
  assert.match(kitNote, /ภาพอ้างอิงลายเส้นเท่านั้น/)
  assert.match(kitNote, /ไม่ใช่ตัวละคร/)
  assert.match(kitNote, /ตัวละครหลักคือ 2 รูปแรกเท่านั้น/)
  assert.match(styleKitFlowNote('ghost', 0), /ไม่ใช่ตัวละคร/)
  const charNote = characterFlowNote({ images: ['a.png', 'b.png'] })
  assert.match(charNote, /2 รูปแรก/)
  assert.match(charNote, /ไม่ใช่ตัวละคร/)
})

test('การส่งลูกค้า: ภาพ kit ส่ง · ต้นฉบับ assets/style-kit-raw ไม่ส่ง · references ไม่ส่ง', () => {
  assert.equal(shipsToCustomer('extension/style-kit/kit-ghost-house.jpg'), true)
  assert.equal(shipsToCustomer('extension/style-kit/kit.json'), true)
  assert.equal(shipsToCustomer('assets/style-kit-raw/kit-ghost-house.png'), false)
  assert.equal(shipsToCustomer('references/onebaht/x.png'), false)
})

// ── ผู้ใช้ตัดสิน 22 พ.ย.: ภาพต้องไม่ออกเหลือง — JPEG ที่ส่งไปกับแอปผ่านตัวแก้สีเดียวกับ inkify (scripts/build-style-kit.mjs) ──
// วัด "พื้นกระดาษ" ด้วยเกณฑ์เดียวกับ paperGains (isPaper: สว่าง ≥165 สีอ่อน ≤0.3) บนภาพย่อ 160px
//   ตำแหน่งที่เป็นพื้นกระดาษในต้นฉบับ (ที่มาของโทนเหลือง) → ในภาพที่ส่ง ต้อง mean R − mean B ≤ 8/255 และ paperGains ไม่มีอะไรให้แก้อีก
//   (ไม่วัดทั้งภาพหลังแก้: ผิว ฟาง ดิน ที่สว่างขึ้นหลังแก้จะถูกนับเป็นกระดาษ แก้ตามนั้นแล้วผ้าขาวกลายเป็นฟ้า — ดูรายงาน Task 10c)
const KIT_CAST_TOLERANCE = 8
const KIT_MIN_SHARE = 0.01 // ต้องตรงกับ scripts/build-style-kit.mjs
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const RAW_DIR = new URL('../assets/style-kit-raw/', import.meta.url)

test('ภาพ kit ที่ส่งไปกับแอปไม่มีโทนเหลือง/ซีเปีย: พื้นกระดาษของต้นฉบับ R−B ≤ 8 · paperGains = null · 768x1152', { skip: !hasFfmpeg && 'ไม่มี ffmpeg' }, async () => {
  const kit = JSON.parse(readFileSync(join(STYLE_KIT_DIR, 'kit.json'), 'utf8'))
  for (const f of kit.files) {
    const p = join(STYLE_KIT_DIR, f.file)
    const dims = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p]).stdout.toString().trim()
    assert.equal(dims, '768,1152', f.file)
    const raw = await thumbRgb(fileURLToPath(new URL(f.file.replace(/\.jpg$/, '.png'), RAW_DIR)))
    const shipped = await thumbRgb(p)
    assert.equal(raw.length, shipped.length, f.file)
    const picked = []
    for (let i = 0; i + 2 < raw.length; i += 3) if (isPaper(raw[i], raw[i + 1], raw[i + 2])) picked.push(shipped[i], shipped[i + 1], shipped[i + 2])
    const n = picked.length / 3
    if (n / (raw.length / 3) < KIT_MIN_SHARE) continue // ไม่มีพื้นกระดาษให้วัด (เช่นภาพที่ขาวเป็นกลางอยู่แล้วแต่เล็กมาก)
    const mean = [0, 1, 2].map((c) => picked.filter((_, k) => k % 3 === c).reduce((a, v) => a + v, 0) / n)
    assert.ok(mean[0] - mean[2] <= KIT_CAST_TOLERANCE, `${f.file}: พื้นกระดาษ R ${mean[0].toFixed(1)} B ${mean[2].toFixed(1)}`)
    assert.equal(paperGains(Buffer.from(picked), { minShare: 0 }), null, `${f.file} ยังมีเหลืองให้แก้`)
  }
})

test('build-style-kit.mjs สร้าง JPEG จาก assets/style-kit-raw ด้วย correctColour (ตัวเดียวกับ inkify) ไม่เขียนทับต้นฉบับ', () => {
  const src = readFileSync(new URL('../scripts/build-style-kit.mjs', import.meta.url), 'utf8')
  assert.match(src, /correctColour/)
  assert.match(src, /style-kit-raw/)
  assert.match(src, /768:1152/)
  assert.match(src, /KIT_MIN_SHARE = 0\.01/) // ต้องตรงกับ KIT_MIN_SHARE ของเทสต์นี้
  assert.match(src, /minShare: KIT_MIN_SHARE/)
  assert.ok(!/colorchannelmixer|edgedetect|noise=|rgbashift/.test(src), 'ห้ามเขียนตัวแก้สีซ้ำ / ห้ามชั้นงานพิมพ์')
  const doc = readFileSync(new URL('../docs/design/phi-style-kit.prompt.txt', import.meta.url), 'utf8')
  assert.match(doc.split(/\r?\n/).slice(0, 8).join('\n'), /build-style-kit\.mjs/)
  assert.match(doc, /clean white paper/)
})
