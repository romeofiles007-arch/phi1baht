// ภาพจาก Flow ห้ามมีขอบกระดาษ/กรอบสีขาว — ตัดขอบออกแล้วขยายเต็มเฟรมเหมือนเดิม
//   node --test scripts/test-trim-border.mjs
// ผู้ใช้ 23 พ.ย. 2026: "ดูสิรูปมีขอบเยอะมาก" · "ไม่เอาขอบ" — คลิปแรก 10 จาก 29 ช็อตเป็นภาพวาดบนแผ่นกระดาษ
// ทั้งที่คำสั่งภาพบอก full-bleed แล้ว (Flow ยังวาดขอบบ้าง) → ชั้นที่สองคือตัดขอบในเครื่องหลังบันทึกภาพ
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { borderBox, trimBorder, trimBordersAll, readInkified } from '../pipeline/lib/inkify.mjs'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** ภาพสังเคราะห์ rgb24: fn(x, y) → [r, g, b] */
function image(w, h, fn) {
  const buf = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) buf.set(fn(x, y), (y * w + x) * 3)
  return buf
}
// เนื้อภาพการ์ตูนกลางคืน: สีเข้มสลับลาย (ไม่เรียบ ไม่ใช่กระดาษ)
const scene = (x, y) => ((x * 7 + y * 13) % 5 < 2 ? [40, 60, 120] : [200, 70, 40])
const W = 100, H = 180

test('ขอบกระดาษครีมรอบด้าน → คืนกรอบเนื้อภาพ (ตัดเผื่อเล็กน้อย)', () => {
  const rgb = image(W, H, (x, y) => (y < 20 || y >= H - 25 || x < 8 || x >= W - 6 ? [246, 240, 226] : scene(x, y)))
  const box = borderBox(rgb, W, H)
  assert.ok(box, 'ต้องเจอขอบ')
  assert.ok(box.top >= 20 / H && box.top < 20 / H + 0.03, `top ${box.top}`)
  assert.ok(box.bottom >= 25 / H && box.bottom < 25 / H + 0.03, `bottom ${box.bottom}`)
  assert.ok(box.left >= 8 / W && box.left < 8 / W + 0.03, `left ${box.left}`)
  assert.ok(box.right >= 6 / W && box.right < 6 / W + 0.03, `right ${box.right}`)
})

test('ขอบเทาอ่อน (กระดาษในเงา) ด้านเดียวก็ตัด', () => {
  const rgb = image(W, H, (x, y) => (y < 15 ? [196, 194, 190] : scene(x, y)))
  const box = borderBox(rgb, W, H)
  assert.ok(box && box.top >= 15 / H, JSON.stringify(box))
  assert.equal(box.left, 0)
})

test('ท้องฟ้าสีฟ้าด้านบนไม่ใช่ขอบ', () => {
  const rgb = image(W, H, (x, y) => (y < 60 ? [150, 200, 240] : scene(x, y)))
  assert.equal(borderBox(rgb, W, H), null)
})

test('ฉากกลางคืนทั้งภาพ → ไม่ตัด', () => {
  assert.equal(borderBox(image(W, H, scene), W, H), null)
})

test('หมอกขาวกินเกือบครึ่งภาพ = ฉากสว่าง ไม่ใช่ขอบ → ไม่ตัด', () => {
  const rgb = image(W, H, (x, y) => (y < H * 0.5 ? [240, 240, 238] : scene(x, y)))
  assert.equal(borderBox(rgb, W, H), null)
})

test('แถบสว่างบางมาก (< 1%) ไม่นับ', () => {
  const rgb = image(W, H, (x, y) => (y < 1 ? [250, 250, 250] : scene(x, y)))
  assert.equal(borderBox(rgb, W, H), null)
})

test('trimBorder: ตัดขอบแล้วขนาดเท่าเดิม มุมไม่ขาว เก็บภาพเดิมไว้ · รอบสองไม่ทำซ้ำ', { skip: !hasFfmpeg }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trim-'))
  try {
    const file = join(dir, '00_00_01.png')
    // ภาพสีน้ำเงินเข้มขนาด 200x300 วางบนกระดาษขาวขนาด 240x420
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x283c78:s=200x300', '-vf', 'noise=alls=40:allf=t,pad=240:420:20:60:color=0xf6f0e2', '-frames:v', '1', file])
    assert.equal(await trimBorder(file), true)
    const size = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim()
    assert.equal(size, '240,420')
    const corner = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'crop=4:4:0:0,format=rgb24', '-f', 'rawvideo', 'pipe:1'])
    assert.ok(Math.max(...corner) < 200, `มุมยังขาว: ${[...corner.subarray(0, 3)]}`)
    assert.ok(existsSync(join(dir, '_original', '_bordered', '00_00_01.png')), 'ต้องเก็บภาพก่อนตัดขอบ')
    assert.equal(await trimBorder(file), false, 'ไม่มีขอบแล้ว ไม่แตะซ้ำ')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('trimBordersAll: ภาพที่แปลงเป็นงานพิมพ์แล้ว ตัดขอบแล้วยังจำว่าแปลงแล้ว (ไม่แปลงซ้ำ)', { skip: !hasFfmpeg }, async () => {
  const { inkify } = await import('../pipeline/lib/inkify.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'trim-'))
  try {
    const file = join(dir, '00_00_02.png')
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x283c78:s=200x300', '-vf', 'noise=alls=40:allf=t,pad=240:420:20:60:color=0xf6f0e2', '-frames:v', '1', file])
    // ภาพเก่า: แปลงไปแล้วทั้งที่ยังมีขอบ
    assert.equal(await inkify(file, { categoryId: 'ghost' }), true)
    assert.equal(await trimBordersAll(dir), 1)
    assert.equal(await inkify(file, { categoryId: 'ghost' }), false, 'ตัดขอบแล้วต้องยังนับว่าแปลงแล้ว')
    assert.ok(Object.keys(readInkified(dir)).includes('00_00_02.png'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ขั้นภาพและแผงข้างตัดขอบทุกครั้ง ไม่ขึ้นกับสวิตช์งานพิมพ์', () => {
  const images = read('pipeline/5_images.mjs')
  assert.ok(images.indexOf('trimBordersAll(') > -1 && images.indexOf('trimBordersAll(') < images.indexOf('if (inkifyEnabled('), 'ต้องตัดขอบก่อนเช็กสวิตช์ inkify')
  const ui = read('bridge/ui.js')
  const api = ui.slice(ui.indexOf("path === '/api/images/inkify'"), ui.indexOf("path === '/api/flow/attachments'"))
  assert.ok(api.indexOf('trimBordersAll(') > -1 && api.indexOf('trimBordersAll(') < api.indexOf('if (!inkifyEnabled('), 'แผงข้างต้องตัดขอบก่อนเช็กสวิตช์')
})
