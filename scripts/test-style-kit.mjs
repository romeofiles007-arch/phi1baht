// เทสต์: Style Kit — ภาพอ้างอิงลายเส้นของเราเอง แนบเป็น ingredient ให้ Flow ทุกช็อต (spec 5.4 ชั้น 1)
//   node --test scripts/test-style-kit.mjs
// kit.json = { files: [{ file, categories: [...], kind: 'scene'|'cover'|'palette' }] } ใน extension/style-kit/
// kit ว่าง/ไฟล์หาย = [] ไม่ throw (ภาพจริงทำทีหลังใน Task 10) · ห้ามอ้างภาพลิขสิทธิ์ใต้ references/
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { styleKitAttachments, styleKitFiles, STYLE_KIT_DIR } from '../pipeline/lib/style-kit.mjs'

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
    assert.ok(!ghost.some((a) => a.name === 'comedy_scene.jpg')) // ชุดสีหมวดอื่นไม่ปน
    assert.deepEqual(Object.keys(ghost[0]).sort(), ['base64', 'name', 'type'])
    assert.equal(ghost[0].type, 'image/png')
    assert.equal(Buffer.from(ghost[0].base64, 'base64').toString('hex'), PNG.toString('hex'))

    const comedy = styleKitAttachments('comedy', { dir })
    assert.equal(comedy[0].name, 'comedy_scene.jpg')
    assert.equal(comedy[0].type, 'image/jpeg')
    assert.equal(styleKitAttachments('ghost', { dir, max: 1 }).length, 1)
    // หมวดที่ไม่มีภาพของตัวเองเลย ได้แค่ภาพที่ระบุหมวดนั้น (ปกรวม) ไม่ใช่ฉากของหมวดอื่น
    assert.deepEqual(styleKitAttachments('folk', { dir }).map((a) => a.name), ['cover.png'])
    assert.deepEqual(styleKitFiles('ghost', { dir }).map((f) => f.file), ['ghost_scene.png', 'cover.png'])
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
  assert.ok(existsSync(join(STYLE_KIT_DIR, '.gitkeep')))
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
