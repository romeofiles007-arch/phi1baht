// Task 6: inkify — แปลงภาพให้เป็นงานพิมพ์เล่มละบาท (ffmpeg ล้วน)
//   node --test scripts/test-inkify.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inkifyFilter, inkify, inkifyAll, paletteOf } from '../pipeline/lib/inkify.mjs'
import { CATEGORIES } from '../extension/prompts.js'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('inkifyFilter: เส้นดำ + ลดสีตามชุดสี + กระดาษ noise/multiply + สีเหลื่อม', () => {
  const f = inkifyFilter({ palette: ['#c0392b', '#f1c40f'], width: 1080, height: 1920, seed: 1 })
  for (const word of ['paletteuse', 'rgbashift', 'noise', 'blend', 'curves', 'gblur']) assert.ok(f.includes(word), word)
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
  assert.match(images, /inkify\s*!==\s*false/)
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
