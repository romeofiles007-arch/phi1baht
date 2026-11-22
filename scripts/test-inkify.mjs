// Task 6: inkify — แปลงภาพให้เป็นงานพิมพ์เล่มละบาท (ffmpeg ล้วน)
//   node --test scripts/test-inkify.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inkifyFilter, inkify, inkifyAll, inkifyEnabled, paletteOf } from '../pipeline/lib/inkify.mjs'
import { CATEGORIES } from '../extension/prompts.js'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('inkifyFilter: เส้นดำ + ลดสีตามชุดสี + กระดาษ noise/multiply + สีเหลื่อม', () => {
  const f = inkifyFilter({ palette: ['#c0392b', '#f1c40f'], width: 1080, height: 1920, seed: 1 })
  for (const word of ['paletteuse', 'rgbashift', 'noise', 'blend', 'colorlevels', 'edgedetect', 'gblur']) assert.ok(f.includes(word), word)
  assert.match(f, /multiply/)
  assert.match(f, /c0392b/i)
  assert.match(f, /s=1080x1920/)
})

test('inkifyFilter: seed เดียวกัน = กราฟเดียวกัน', () => {
  const a = { palette: ['#000000', '#ffffff'], width: 64, height: 64, seed: 7 }
  assert.equal(inkifyFilter(a), inkifyFilter({ ...a }))
  assert.notEqual(inkifyFilter(a), inkifyFilter({ ...a, seed: 8 }))
})

test('paletteOf: หมวดที่ไม่รู้จัก/ว่าง ใช้ชุดสีนิทานพื้นบ้านแทน ไม่โยนข้อผิดพลาด', () => {
  const folk = CATEGORIES.find((c) => c.id === 'folk').palette
  assert.deepEqual(paletteOf('nope'), folk)
  assert.deepEqual(paletteOf(undefined), folk)
  assert.deepEqual(paletteOf('ghost'), CATEGORIES.find((c) => c.id === 'ghost').palette)
})

test('ต่อเข้า 5_images / profile / แผงข้าง', () => {
  const images = read('pipeline/5_images.mjs')
  assert.match(images, /inkifyAll/)
  assert.match(images, /inkifyEnabled\(loadConfig\(\)/) // อ่านสวิตช์ตอนรันขั้นนี้ ไม่ใช่ค่าที่แช่ไว้ในโปรไฟล์
  assert.match(read('pipeline/lib/clip_profile.mjs'), /inkify/)
  assert.match(read('bridge/ui.js'), /body\.inkify/)
  assert.match(read('extension/sidepanel.html'), /clipInkify/)
  assert.match(read('extension/sidepanel.html'), /แปลงเป็นงานพิมพ์/)
  assert.match(read('extension/sidepanel.js'), /clipInkify/)
})

const rawPixels = (file) => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 1 << 26 })
const size = (file) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim()

test('inkify integration: เก็บต้นฉบับ · ขนาดเท่าเดิม · ไม่ทำซ้ำ · ยังเป็นภาพสี', { skip: !hasFfmpeg && 'ไม่มี ffmpeg' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inkify-'))
  try {
    const f = join(dir, '00_00_01.png')
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=64x64', '-frames:v', '1', f])
    assert.equal(await inkify(f, { categoryId: 'ghost' }), true)
    assert.ok(existsSync(join(dir, '_original', '00_00_01.png')))
    assert.equal(size(f), '64,64')
    assert.equal(await inkify(f, { categoryId: 'ghost' }), false)
    const px = rawPixels(f)
    let sum = 0
    for (let i = 0; i + 2 < px.length; i += 3) sum += Math.abs(px[i] - px[i + 1]) + Math.abs(px[i + 1] - px[i + 2])
    assert.ok(sum / (px.length / 3) > 8, `ภาพต้องยังเป็นสี (${sum / (px.length / 3)})`)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('inkifyAll: ข้าม riddle · แปลงปก · ไฟล์เสียไม่ล้มทั้งขั้น (เตือนแล้วเก็บต้นฉบับ)', { skip: !hasFfmpeg && 'ไม่มี ffmpeg' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inkify-'))
  try {
    for (const n of ['00_00_01.png', 'cover.png', 'riddle.png']) execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=s=64x64', '-frames:v', '1', join(dir, n)])
    const bad = join(dir, '00_00_02.png')
    execFileSync('node', ['-e', `require('fs').writeFileSync(${JSON.stringify(bad)}, 'not an image')`])
    const warns = []
    const n = await inkifyAll(dir, { categoryId: 'drama', log: (m) => warns.push(m) })
    assert.equal(n, 2)
    assert.ok(existsSync(join(dir, '_original', 'cover.png')))
    assert.ok(!existsSync(join(dir, '_original', 'riddle.png')))
    assert.ok(!existsSync(join(dir, '_original', '00_00_02.png')))
    assert.equal(readFileSync(bad, 'utf8'), 'not an image')
    assert.ok(warns.some((m) => m.includes('00_00_02.png')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('inkifyEnabled: สวิตช์ปัจจุบันมีผลกับคลิปเดิม · profile.inkify === false ปิดเฉพาะคลิป', () => {
  assert.equal(inkifyEnabled({ render: {} }, { inkify: true }), true)
  assert.equal(inkifyEnabled({ render: {} }, null), true)
  assert.equal(inkifyEnabled({ render: { inkify: false } }, { inkify: true }), false) // ปิดในแผงข้างหลังสร้างคลิป → ปิดจริง
  assert.equal(inkifyEnabled({ render: { inkify: true } }, { inkify: false }), false)
})

// ── ภาพสังเคราะห์: ผิว/ฟ้า/ขาว ต้องยังเป็นสีธรรมชาติ ภาพไม่มืดลง (เกณฑ์ที่ควรจับปัญหา "โคลนดำ/ผิวม่วง" ได้) ──
const PATCHES = { skin: [232, 183, 150], sky: [135, 206, 235], white: [250, 250, 250] }
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  if (!d) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
function patchMeans(file) {
  const px = rawPixels(file) // 3 แถบกว้าง 64 สูง 192 — วัดกลางแถบ (เลี่ยงขอบแถบที่สีเหลื่อมและขอบภาพที่หมองจากกระดาษ)
  const W = 192, out = {}
  Object.keys(PATCHES).forEach((name, i) => {
    let n = 0; const sum = [0, 0, 0]
    for (let y = 60; y < 132; y++) for (let x = i * 64 + 16; x < i * 64 + 48; x++) { for (let c = 0; c < 3; c++) sum[c] += px[(y * W + x) * 3 + c]; n++ }
    out[name] = sum.map((v) => v / n)
  })
  return out
}

for (const categoryId of ['ghost', 'folk', 'drama']) {
  test(`inkify ไม่ทำลายสีธรรมชาติ (${categoryId}): ผิว/ฟ้า/ขาวคงเดิม สว่างไม่ลดเกิน 12%`, { skip: !hasFfmpeg && 'ไม่มี ffmpeg' }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'inkify-'))
    try {
      const f = join(dir, '00_00_01.png')
      const src = Object.values(PATCHES).map(([r, g, b], i) => `color=c=0x${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}:s=64x192[c${i}]`)
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-filter_complex', `${src.join(';')};[c0][c1][c2]hstack=inputs=3`, '-frames:v', '1', f].map((a) => a), { stdio: 'pipe' })
      assert.equal(await inkify(f, { categoryId }), true)
      const got = patchMeans(f)
      for (const [name, rgb] of Object.entries(PATCHES)) {
        const m = got[name]
        for (let c = 0; c < 3; c++) assert.ok(Math.abs(m[c] - rgb[c]) <= 20, `${name} ช่อง ${c}: ${m[c].toFixed(0)} vs ${rgb[c]}`) // ช่องสีเพี้ยนไม่เกิน 20/255
        if (name !== 'white') {
          const dh = Math.abs(hueOf(m) - hueOf(rgb))
          assert.ok(Math.min(dh, 360 - dh) <= 10, `${name} hue ${hueOf(m).toFixed(0)} vs ${hueOf(rgb).toFixed(0)}`) // ฮิวเพี้ยนไม่เกิน 10°
        }
        assert.ok(luma(m) >= luma(rgb) * 0.92, `${name} มืดลง: ${luma(m).toFixed(0)} vs ${luma(rgb).toFixed(0)}`)
      }
      const meanOf = (o) => Object.values(o).reduce((a, v) => a + luma(v), 0) / 3
      assert.ok(meanOf(got) >= meanOf(PATCHES) * 0.88, 'ความสว่างรวมลดเกิน 12%')
      assert.ok(luma(got.skin) > 150, 'ผิวต้องไม่มืดจนเป็นโคลน')
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
}

test('inkify: ภาพดิบที่ Flow โหลดทับใหม่ ถูกแปลงใหม่ และต้นฉบับ = ภาพดิบใหม่ · ไม่โหลดทับ = ไม่แตะต้นฉบับ', { skip: !hasFfmpeg && 'ไม่มี ffmpeg' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inkify-'))
  try {
    const f = join(dir, '00_00_01.png')
    const mk = (c) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${c}:s=64x64`, '-frames:v', '1', f])
    mk('red')
    assert.equal(await inkify(f, { categoryId: 'folk' }), true)
    const keep = join(dir, '_original', '00_00_01.png')
    const firstOriginal = readFileSync(keep)
    assert.equal(await inkify(f, { categoryId: 'folk' }), false)
    assert.deepEqual(readFileSync(keep), firstOriginal) // ไม่ทับต้นฉบับด้วยภาพที่แปลงแล้ว
    mk('blue') // Flow โหลดภาพใหม่ทับ
    const later = new Date(Date.now() + 5000)
    utimesSync(f, later, later)
    const raw = readFileSync(f)
    assert.equal(await inkify(f, { categoryId: 'folk' }), true)
    assert.deepEqual(readFileSync(keep), raw)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
