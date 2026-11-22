// Task 6: inkify — แปลงภาพให้เป็นงานพิมพ์เล่มละบาท (ffmpeg ล้วน)
//   node --test scripts/test-inkify.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inkifyFilter, inkify, inkifyAll, inkifyEnabled, paletteOf, paperGains, paperGainsOf, colorMatrix, SATURATION } from '../pipeline/lib/inkify.mjs'
import { CATEGORIES } from '../extension/prompts.js'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('inkifyFilter: เส้นดำ + ลดสีตามชุดสี + กระดาษ noise/multiply + สีเหลื่อม', () => {
  const f = inkifyFilter({ palette: ['#c0392b', '#f1c40f'], width: 1080, height: 1920, seed: 1 })
  for (const word of ['paletteuse', 'rgbashift', 'noise', 'blend', 'colorlevels', 'edgedetect', 'gblur']) assert.ok(f.includes(word), word)
  assert.match(f, /multiply/)
  assert.match(f, /c0392b/i)
  assert.match(f, /s=1080x1920/)
  assert.match(f, /colorchannelmixer=/) // ปรับขาวเป็นกลาง + เพิ่มความสดของสี ก่อนแปลงเป็นงานพิมพ์
  // กระดาษเป็นกลาง: เกรนขาว/เทา (สร้างเป็นภาพเทาแล้วค่อยเป็นสี = ทุกช่องเท่ากัน) ไม่มีสีครีม ไม่มีขอบหมอง
  assert.ok(!/fffaf0|vignette/i.test(f), f)
  assert.match(f, /color=c=0xffffff[^;]*format=gray,noise=/)
})

test('inkifyFilter: เมทริกซ์สีอยู่ต้นกราฟ (ก่อนแยกไปทำเส้น/ลดสี) · gains = null ก็ยังเพิ่มความสด', () => {
  const f = inkifyFilter({ palette: ['#c0392b', '#ffffff'], width: 64, height: 64, seed: 1, gains: { r: 1, g: 1.05, b: 1.25 } })
  assert.match(f, /\[0:v\]colorchannelmixer=[^;]*split=3/)
  const g = inkifyFilter({ palette: ['#c0392b', '#ffffff'], width: 64, height: 64, seed: 1 })
  assert.match(g, /\[0:v\]colorchannelmixer=/)
  assert.notEqual(f, g)
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

// ── ผู้ใช้ตัดสิน 22 พ.ย.: "อย่าให้ภาพออกเหลืองเอาสีสดใส" — ปรับขาวให้เป็นกลาง (port จาก paper-tone ของแอปต้นแบบ) + เพิ่มความสด ──
/** ภาพจำลอง: n พิกเซลสีเดียว ต่อกันเป็น rgb24 */
const fill = (parts) => Buffer.from(parts.flatMap(([rgb, n]) => Array.from({ length: n }, () => rgb).flat()))

test('paperGains: พื้นกระดาษเหลืองนวล → ยกเขียว/ฟ้าขึ้นให้พื้นเป็นขาวกลาง (แดงไม่ถูกลด)', () => {
  const g = paperGains(fill([[[226, 212, 182], 700], [[60, 80, 110], 300]])) // กระดาษ 70% + ชุดคราม 30%
  assert.ok(g, 'ต้องปรับ')
  assert.equal(g.r, 1)
  assert.ok(g.g > 1 && g.b > g.g, JSON.stringify(g))
  const [r, gg, b] = [226 * g.r, 212 * g.g, 182 * g.b]
  assert.ok(Math.max(r, gg, b) - Math.min(r, gg, b) <= 2, `${r} ${gg} ${b}`)
})

test('paperGains: ภาพที่พื้นเป็นกลาง/โทนเย็นอยู่แล้ว → ไม่แตะ', () => {
  assert.equal(paperGains(fill([[[240, 242, 244], 600], [[40, 70, 60], 400]])), null)
  assert.equal(paperGains(fill([[[205, 222, 236], 800], [[30, 40, 70], 200]])), null)
  assert.equal(paperGains(fill([[[250, 250, 250], 500], [[200, 40, 40], 500]])), null) // ขาวจริง + แดงสด
})

test('paperGains: ฉากกลางคืน จุดสว่างเป็นเปลวตะเกียง (สีจัด) ไม่ใช่กระดาษ → ไม่แตะ ไม่ทำให้ฉากอมฟ้า', () => {
  assert.equal(paperGains(fill([[[255, 150, 40], 40], [[20, 30, 60], 900], [[90, 100, 130], 60]])), null)
})

test('paperGains: เหลืองจัดมากก็ปรับแค่พอดี (เพดาน ×1.35) · ไม่ลดช่องใด · เขียวนำแดงก็ไม่ลดเขียว', () => {
  const g = paperGains(fill([[[236, 214, 170], 900], [[50, 50, 50], 100]])) // ฟ้าขาด ×1.39 → เพดาน
  assert.ok(g && g.b === 1.35 && g.g <= 1.35 && g.r === 1, JSON.stringify(g))
  const lime = paperGains(fill([[[220, 232, 190], 900], [[50, 50, 50], 100]]))
  assert.ok(lime && lime.r === 1 && lime.g === 1 && lime.b > 1, JSON.stringify(lime))
})

test('paperGains: เหลืองเป็นสีของสิ่งของ (เสื้อเหลืองสด ท้องฟ้าเหลืองจัด) ไม่ใช่กระดาษ → ไม่แตะ', () => {
  assert.equal(paperGains(fill([[[245, 200, 40], 600], [[250, 250, 250], 200], [[40, 60, 120], 200]])), null)
})

test('colorMatrix: ไม่มี gains + ความสด 1 = เมทริกซ์เอกลักษณ์ · ความสดคงสีเทา · gains คูณเข้าคอลัมน์', () => {
  assert.deepEqual(colorMatrix(null, 1), [1, 0, 0, 0, 1, 0, 0, 0, 1])
  const apply = (m, [r, g, b]) => [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b]
  for (const v of apply(colorMatrix(null, SATURATION), [128, 128, 128])) assert.ok(Math.abs(v - 128) < 0.05, 'เทาต้องคงเป็นเทา') // ปัดทศนิยม 4 ตำแหน่ง
  const wb = apply(colorMatrix({ r: 1, g: 1.05, b: 1.25 }, SATURATION), [200, 200 / 1.05, 160])
  assert.ok(Math.max(...wb) - Math.min(...wb) < 0.5, `ขาวหลังปรับ ${wb}`)
  assert.ok(SATURATION >= 1.1 && SATURATION <= 1.2, `ความสด ${SATURATION}`)
})

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'pipe' })
const hex = ([r, g, b]) => [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
function meanRect(file, W, [x0, y0, x1, y1]) {
  const px = rawPixels(file), sum = [0, 0, 0]
  let n = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { for (let c = 0; c < 3; c++) sum[c] += px[(y * W + x) * 3 + c]; n++ }
  return sum.map((v) => v / n)
}
const satOf = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b)

test('inkify: ภาพที่ Flow วาดบนกระดาษเหลือง (#efe2bf) → พื้นเป็นขาวกลาง ไม่มืดลง · สีกลางสดขึ้น · ผิวยังเป็นสีผิว', { skip: !hasFfmpeg && 'ไม่มี ffmpeg' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inkify-'))
  try {
    const f = join(dir, '00_00_01.png')
    const paper = [239, 226, 191], mid = [70, 130, 190], skin = [232, 183, 150]
    // พื้นกระดาษเหลือง 240x240 + แถบสีกลาง (ซ้ายล่าง) + แถบผิว (ขวาล่าง) + สี่เหลี่ยมแดง (ขวาบน)
    ff(['-f', 'lavfi', '-i', `color=c=0x${hex(paper)}:s=240x240`, '-vf',
      `drawbox=x=0:y=150:w=110:h=90:color=0x${hex(mid)}:t=fill,drawbox=x=130:y=150:w=110:h=90:color=0x${hex(skin)}:t=fill,drawbox=x=170:y=20:w=60:h=60:color=0xc8322e:t=fill`,
      '-frames:v', '1', f])
    assert.ok(await paperGainsOf(f), 'ต้องตรวจเจอว่าพื้นเหลือง')
    assert.equal(await inkify(f, { categoryId: 'folk' }), true)
    const bg = meanRect(f, 240, [20, 20, 140, 120])
    assert.ok(Math.abs(bg[2] - bg[0]) <= 6, `พื้นยังเหลือง: R ${bg[0].toFixed(1)} B ${bg[2].toFixed(1)}`)
    assert.ok(luma(bg) >= luma(paper), `พื้นมืดลง: ${luma(bg).toFixed(1)} vs ${luma(paper).toFixed(1)}`)
    const m = meanRect(f, 240, [20, 170, 90, 225])
    assert.ok(satOf(m) > satOf(mid), `สีกลางต้องสดขึ้น: ${satOf(m).toFixed(3)} vs ${satOf(mid).toFixed(3)}`)
    const s = meanRect(f, 240, [150, 170, 220, 225])
    assert.ok(s[0] > s[1] && s[1] >= s[2] && s[0] - s[2] >= 25 && hueOf(s) <= 40, `ผิวเพี้ยน: ${s.map((v) => v.toFixed(0))}`)
    assert.ok(luma(s) >= luma(skin) * 0.92, 'ผิวมืดลง')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('inkify: ขาวจริงยังขาวกลาง (|R−B| ≤ 6) ทุกหมวด · สีกลางบนพื้นขาวสดขึ้น', { skip: !hasFfmpeg && 'ไม่มี ffmpeg' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inkify-'))
  try {
    const f = join(dir, '00_00_01.png')
    const mid = [70, 130, 190]
    for (const categoryId of ['ghost', 'saiyasat', 'folk', 'drama', 'comedy']) {
      rmSync(join(dir, '_original'), { recursive: true, force: true })
      ff(['-f', 'lavfi', '-i', 'color=c=0xffffff:s=200x200', '-vf', `drawbox=x=100:y=0:w=100:h=200:color=0x${hex(mid)}:t=fill`, '-frames:v', '1', f])
      assert.equal(await inkify(f, { categoryId }), true)
      const w = meanRect(f, 200, [15, 15, 85, 185])
      assert.ok(Math.abs(w[0] - w[2]) <= 6 && Math.abs(w[0] - w[1]) <= 6, `${categoryId} ขาวไม่กลาง: ${w.map((v) => v.toFixed(1))}`)
      assert.ok(luma(w) >= 240, `${categoryId} ขาวหม่น: ${luma(w).toFixed(1)}`)
      const m = meanRect(f, 200, [115, 15, 185, 185])
      assert.ok(satOf(m) > satOf(mid), `${categoryId} สีกลางต้องสดขึ้น: ${satOf(m).toFixed(3)}`)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('inkify: ฉากกลางคืนไม่มีพื้นกระดาษ → ไม่ปรับขาว (paperGainsOf = null) และสีไม่ถูกดันไปฟ้า', { skip: !hasFfmpeg && 'ไม่มี ffmpeg' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inkify-'))
  try {
    const f = join(dir, '00_00_01.png')
    const night = [20, 30, 60]
    ff(['-f', 'lavfi', '-i', `color=c=0x${hex(night)}:s=200x200`, '-vf', 'drawbox=x=90:y=90:w=12:h=12:color=0xff9628:t=fill', '-frames:v', '1', f])
    assert.equal(await paperGainsOf(f), null)
    // ภาพที่ควรได้ = กราฟเดียวกันแต่ไม่มีตัวปรับขาว (gains = null)
    const want = join(dir, 'want.png')
    ff(['-i', f, '-filter_complex', inkifyFilter({ palette: paletteOf('ghost'), width: 200, height: 200, seed: 1 }), '-map', '[out]', '-frames:v', '1', want])
    assert.equal(await inkify(f, { categoryId: 'ghost' }), true)
    const m = meanRect(f, 200, [10, 10, 70, 70]), w = meanRect(want, 200, [10, 10, 70, 70])
    for (let c = 0; c < 3; c++) assert.ok(Math.abs(m[c] - w[c]) <= 2, `ช่อง ${c}: ${m[c].toFixed(1)} vs ${w[c].toFixed(1)}`)
    assert.ok(m[2] - m[0] <= night[2] - night[0] + 8, 'ฉากกลางคืนถูกดันไปฟ้า')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
